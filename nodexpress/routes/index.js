const express = require('express');
const userRoutes = require('./userRouets');
const authRoutes = require('./authRoutes');

const setupRoutes = (app) => {
  const apiVersion = process.env.API_VERSION || 'v1';
  const apiPrefix = `/api/${apiVersion}`;

  app.use(`${apiPrefix}/auth`, authRoutes);
  
  app.use(`${apiPrefix}/users`, userRoutes);

  app.get(`${apiPrefix}`, (req, res) => {
    res.json({
      success: true,
      message: 'Node.js CRUD API',
      version: apiVersion,
      endpoints: {
        auth: `${apiPrefix}/auth`,
        users: `${apiPrefix}/users`
      },
      documentation: 'Check the README.md for API documentation'
    });
  });

  console.log('✅ Routes configured successfully');
  console.log(`📡 API Base URL: ${apiPrefix}`);
};

module.exports = setupRoutes;