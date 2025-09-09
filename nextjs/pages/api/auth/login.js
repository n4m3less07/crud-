import bcrypt from 'bcryptjs';
import { query } from '../../../lib/database';
import { generateToken, validateRequest } from '../../../lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        // Validate request
        const validation = validateRequest({
            email: [
                { required: true },
                { email: true }
            ],
            password: [
                { required: true }
            ]
        });

        const validationResult = validation(req, res);
        if (validationResult !== true) return validationResult;

        const { email, password } = req.body;

        // Find user
        const userResult = await query(
            'SELECT id, name, email, password, role FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = userResult.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = generateToken({
            id: user.id,
            email: user.email
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
}