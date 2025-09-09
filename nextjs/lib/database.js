import { Pool } from 'pg';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lcrud_db',
    port: process.env.DB_PORT || 5432,
    max: 20, // maximum number of connections in the pool
    idleTimeoutMillis: 30000, // close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

let pool;

// Initialize connection pool
const getPool = () => {
    if (!pool) {
        pool = new Pool(dbConfig);
        
        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }
    return pool;
};

// Test connection
export const testConnection = async () => {
    try {
        const client = await getPool().connect();
        console.log('✅ PostgreSQL connected successfully');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
        return false;
    }
};

// Initialize database and create tables
export const initializeDatabase = async () => {
    try {
        const client = await getPool().connect();
        
        try {
            // Create users table if it doesn't exist
            const createUsersTable = `
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Create blacklisted_tokens table for logout functionality
            const createBlacklistTable = `
                CREATE TABLE IF NOT EXISTS blacklisted_tokens (
                    id SERIAL PRIMARY KEY,
                    token_jti VARCHAR(255) UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Create indexes
            const createIndexes = `
                CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_jti ON blacklisted_tokens(token_jti);
                CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            `;

            // Create trigger to update updated_at column
            const createTrigger = `
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';

                DROP TRIGGER IF EXISTS update_users_updated_at ON users;
                CREATE TRIGGER update_users_updated_at
                    BEFORE UPDATE ON users
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            `;

            await client.query(createUsersTable);
            await client.query(createBlacklistTable);
            await client.query(createIndexes);
            await client.query(createTrigger);
            
            console.log('✅ Database tables initialized successfully');
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        return false;
    }
};

// Clean up expired tokens
export const cleanupExpiredTokens = async () => {
    try {
        const client = await getPool().connect();
        try {
            const result = await client.query('DELETE FROM blacklisted_tokens WHERE expires_at < NOW()');
            console.log(`🧹 Cleaned up ${result.rowCount} expired tokens`);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Token cleanup error:', error.message);
    }
};

// Execute query with automatic connection management
export const query = async (text, params) => {
    const client = await getPool().connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
};

export { getPool as pool };