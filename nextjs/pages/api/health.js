import { testConnection } from '../../lib/database';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        const dbStatus = await testConnection();
        
        res.status(200).json({
            success: true,
            status: 'healthy',
            service: 'nextjs-postgresql-crud-api',
            environment: process.env.NODE_ENV || 'development',
            database: dbStatus ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
}