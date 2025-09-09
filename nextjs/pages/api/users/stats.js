import { query } from '../../../lib/database';
import { withAuth } from '../../../lib/auth';

async function statsHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        // Get total users count
        const totalUsersResult = await query('SELECT COUNT(*) as total FROM users');
        
        // Get users by role
        const usersByRoleResult = await query(`
            SELECT role, COUNT(*) as count 
            FROM users 
            GROUP BY role
        `);
        
        // Get recent registrations (last 30 days)
        const recentRegistrationsResult = await query(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);
        
        // Get users registered per month (last 12 months)
        const monthlyRegistrationsResult = await query(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM') as month,
                COUNT(*) as count
            FROM users 
            WHERE created_at >= NOW() - INTERVAL '12 months'
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ORDER BY month
        `);

        // Get most recent users
        const recentUsersResult = await query(`
            SELECT id, name, email, role, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        res.status(200).json({
            success: true,
            data: {
                totalUsers: parseInt(totalUsersResult.rows[0].total),
                usersByRole: usersByRoleResult.rows.reduce((acc, curr) => {
                    acc[curr.role] = parseInt(curr.count);
                    return acc;
                }, {}),
                recentRegistrations: parseInt(recentRegistrationsResult.rows[0].count),
                monthlyRegistrations: monthlyRegistrationsResult.rows.map(row => ({
                    month: row.month,
                    count: parseInt(row.count)
                })),
                recentUsers: recentUsersResult.rows
            }
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching statistics'
        });
    }
}

// Only admins can view user statistics
export default withAuth(statsHandler, { requireAdmin: true });