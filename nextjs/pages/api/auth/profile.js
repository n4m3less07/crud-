import { query } from '../../../lib/database';
import { withAuth } from '../../../lib/auth';

async function logoutHandler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        const { tokenJti, tokenExp } = req.user;
        
        // Add token to blacklist
        const expiresAt = new Date(tokenExp * 1000); // Convert from Unix timestamp
        
        await query(
            'INSERT INTO blacklisted_tokens (token_jti, expires_at) VALUES ($1, $2) ON CONFLICT (token_jti) DO UPDATE SET expires_at = EXCLUDED.expires_at',
            [tokenJti, expiresAt]
        );

        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout'
        });
    }
}

export default withAuth(logoutHandler);