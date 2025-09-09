import jwt from 'jsonwebtoken';
import { query } from './database';

// Generate JWT token
export const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
        jwtid: `${payload.id}_${Date.now()}` // Unique identifier for each token
    });
};

// Verify JWT token
export const verifyToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if token is blacklisted
        const blacklistResult = await query(
            'SELECT id FROM blacklisted_tokens WHERE token_jti = $1',
            [decoded.jti]
        );

        if (blacklistResult.rows.length > 0) {
            throw new Error('Token has been invalidated');
        }

        // Check if user still exists
        const userResult = await query(
            'SELECT id, name, email, role FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        return {
            ...userResult.rows[0],
            tokenJti: decoded.jti,
            tokenExp: decoded.exp
        };
    } catch (error) {
        throw error;
    }
};

// Authentication middleware for API routes
export const withAuth = (handler, options = {}) => {
    return async (req, res) => {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'Access token required'
                });
            }

            const user = await verifyToken(token);
            req.user = user;

            // Check admin requirement
            if (options.requireAdmin && user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            // Check ownership requirement
            if (options.requireOwnership) {
                const userId = parseInt(req.query.id);
                if (user.role !== 'admin' && user.id !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied. You can only access your own resources.'
                    });
                }
            }

            return handler(req, res);

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired'
                });
            }
            
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token'
                });
            }

            return res.status(401).json({
                success: false,
                message: error.message || 'Authentication failed'
            });
        }
    };
};

// Validation helper
export const validateRequest = (validations) => {
    return (req, res, next) => {
        const errors = [];
        
        for (const [field, rules] of Object.entries(validations)) {
            const value = req.body[field];
            
            for (const rule of rules) {
                if (rule.required && (!value || value.toString().trim() === '')) {
                    errors.push(`${field} is required`);
                    break;
                }
                
                if (value && rule.minLength && value.toString().length < rule.minLength) {
                    errors.push(`${field} must be at least ${rule.minLength} characters long`);
                }
                
                if (value && rule.maxLength && value.toString().length > rule.maxLength) {
                    errors.push(`${field} must be no more than ${rule.maxLength} characters long`);
                }
                
                if (value && rule.email && !/\S+@\S+\.\S+/.test(value)) {
                    errors.push(`${field} must be a valid email address`);
                }
                
                if (value && rule.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
                    errors.push(`${field} must contain at least one uppercase letter, one lowercase letter, and one number`);
                }
                
                if (value && rule.enum && !rule.enum.includes(value)) {
                    errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
                }
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }
        
        return next ? next() : true;
    };
};