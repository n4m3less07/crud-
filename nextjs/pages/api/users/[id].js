import bcrypt from 'bcryptjs';
import { query } from '../../../lib/database';
import { withAuth, validateRequest } from '../../../lib/auth';

async function userHandler(req, res) {
    const userId = parseInt(req.query.id);

    if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Valid user ID required'
        });
    }

    switch (req.method) {
        case 'GET':
            return getUserById(req, res, userId);
        case 'PUT':
            return updateUser(req, res, userId);
        case 'DELETE':
            return deleteUser(req, res, userId);
        default:
            return res.status(405).json({
                success: false,
                message: 'Method not allowed'
            });
    }
}

// Get user by ID
async function getUserById(req, res, userId) {
    try {
        const userResult = await query(
            'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: userResult.rows[0]
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user'
        });
    }
}

// Update user
async function updateUser(req, res, userId) {
    try {
        // Validate request based on fields provided
        const validationRules = {};
        
        if (req.body.name !== undefined) {
            validationRules.name = [{ minLength: 2 }, { maxLength: 50 }];
        }
        if (req.body.email !== undefined) {
            validationRules.email = [{ email: true }];
        }
        if (req.body.password !== undefined) {
            validationRules.password = [{ minLength: 6 }, { password: true }];
        }
        if (req.body.role !== undefined) {
            validationRules.role = [{ enum: ['admin', 'user'] }];
        }

        if (Object.keys(validationRules).length > 0) {
            const validation = validateRequest(validationRules);
            const validationResult = validation(req, res);
            if (validationResult !== true) return validationResult;
        }

        const { name, email, password, role } = req.body;

        // Check if user exists
        const existingUserResult = await query(
            'SELECT id, role FROM users WHERE id = $1',
            [userId]
        );

        if (existingUserResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Non-admin users cannot change role
        if (role && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admin can change user roles'
            });
        }

        // Check if email already exists for another user
        if (email) {
            const emailCheckResult = await query(
                'SELECT id FROM users WHERE email = $1 AND id != $2',
                [email.toLowerCase(), userId]
            );

            if (emailCheckResult.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = ${paramIndex}`);
            values.push(name.trim());
            paramIndex++;
        }

        if (email !== undefined) {
            updates.push(`email = ${paramIndex}`);
            values.push(email.toLowerCase());
            paramIndex++;
        }

        if (password !== undefined) {
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            updates.push(`password = ${paramIndex}`);
            values.push(hashedPassword);
            paramIndex++;
        }

        if (role !== undefined && req.user.role === 'admin') {
            updates.push(`role = ${paramIndex}`);
            values.push(role);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        values.push(userId);

        const updateResult = await query(
            `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ${paramIndex} RETURNING id, name, email, role, created_at, updated_at`,
            values
        );

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: {
                user: updateResult.rows[0]
            }
        });

    } catch (error) {
        console.error('Update user error:', error);
        
        if (error.code === '23505') { // unique_violation
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error updating user'
        });
    }
}

// Delete user
async function deleteUser(req, res, userId) {
    try {
        // Check if user exists
        const userResult = await query(
            'SELECT id, name FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Delete user
        await query('DELETE FROM users WHERE id = $1', [userId]);

        // Blacklist any existing tokens for this user (security measure)
        await query(
            'INSERT INTO blacklisted_tokens (token_jti, expires_at) VALUES ($1, $2) ON CONFLICT (token_jti) DO NOTHING',
            [`${userId}_deleted_${Date.now()}`, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        res.status(200).json({
            success: true,
            message: `User ${user.name} deleted successfully`
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting user'
        });
    }
}

// Admin can access any user, users can only access their own data
export default withAuth(userHandler, { requireOwnership: true });