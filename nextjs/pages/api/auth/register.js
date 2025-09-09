import bcrypt from 'bcryptjs';
import { query, initializeDatabase } from '../../../lib/database';
import { generateToken, validateRequest } from '../../../lib/auth';

// Initialize database on first request
let dbInitialized = false;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    // Initialize database if not already done
    if (!dbInitialized) {
        await initializeDatabase();
        dbInitialized = true;
    }

    try {
        // Validate request
        const validation = validateRequest({
            name: [
                { required: true },
                { minLength: 2 },
                { maxLength: 50 }
            ],
            email: [
                { required: true },
                { email: true }
            ],
            password: [
                { required: true },
                { minLength: 6 },
                { password: true }
            ]
        });

        const validationResult = validation(req, res);
        if (validationResult !== true) return validationResult;

        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUserResult = await query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUserResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user
        const result = await query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role',
            [name.trim(), email.toLowerCase(), hashedPassword]
        );

        const newUser = result.rows[0];

        // Generate JWT token
        const token = generateToken({
            id: newUser.id,
            email: newUser.email
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: newUser,
                token
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle PostgreSQL duplicate entry error
        if (error.code === '23505') { // unique_violation
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
}