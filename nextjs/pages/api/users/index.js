import { query } from '../../../lib/database';
import { withAuth } from '../../../lib/auth';

async function usersHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100 per page
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role || '';

        let queryText = 'SELECT id, name, email, role, created_at, updated_at FROM users';
        let countQueryText = 'SELECT COUNT(*) as total FROM users';
        let queryParams = [];
        let conditions = [];
        let paramIndex = 1;

        // Add search condition
        if (search) {
            conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1})`);
            queryParams.push(`%${search}%`, `%${search}%`);
            paramIndex += 2;
        }

        // Add role filter
        if (role && ['admin', 'user'].includes(role)) {
            conditions.push(`role = $${paramIndex}`);
            queryParams.push(role);
            paramIndex += 1;
        }

        // Build WHERE clause
        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            queryText += whereClause;
            countQueryText += whereClause;
        }

        // Add pagination
        queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        const paginationParams = [...queryParams, limit, offset];

        // Execute queries
        const [usersResult, countResult] = await Promise.all([
            query(queryText, paginationParams),
            query(countQueryText, queryParams)
        ]);

        const totalUsers = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalUsers / limit);

        res.status(200).json({
            success: true,
            data: {
                users: usersResult.rows,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalUsers,
                    limit,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching users'
        });
    }
}

// Only admins can view all users
export default withAuth(usersHandler, { requireAdmin: true });