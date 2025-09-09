const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import utilities and middleware
const { connectDB } = require('./utils/database');
const { initJWT } = require('./middleware/auth');
const setupRoutes = require('./routes');

const app = express();

// Initialize JWT
initJWT();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Connect to database
connectDB();

// Setup routes
setupRoutes(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'nodejs-crud-api',
    environment: getEnv(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});


// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// Get environment
function getEnv() {
  return process.env.NODE_ENV || 'development';
}

// Start server
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server starting on port ${PORT}...`);
  console.log(`🌍 Environment: ${getEnv()}`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/health`);
});

module.exports = app;