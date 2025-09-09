const jwt = require('jsonwebtoken');
const User = require('../models/User');

const blacklistedTokens = new Set();

let JWT_SECRET;

const initJWT = () => {
  JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  Warning: Using fallback JWT secret. Set JWT_SECRET in .env file');
  }
  console.log('✅ JWT initialized');
};

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

const jwtMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1]; 
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    if (blacklistedTokens.has(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token is no longer valid.'
      });
    }

    const decoded = verifyToken(token);

    const user = await User.findById(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive.'
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    } else {
      console.error('JWT Middleware Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

const blacklistToken = (token) => {
  blacklistedTokens.add(token);
};

const cleanBlacklist = () => {
  console.log(`Blacklisted tokens: ${blacklistedTokens.size}`);
};

module.exports = {
  initJWT,
  generateToken,
  verifyToken,
  jwtMiddleware,
  adminMiddleware,
  blacklistToken,
  cleanBlacklist
};
