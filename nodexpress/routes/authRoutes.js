const express = require('express');
const { registerUser, loginUser, logoutUser } = require('../controllers/userController');
const { validateRegister, validateLogin } = require('../middleware/validation.js');
const { jwtMiddleware } = require('../middleware/auth');

const router = express.Router();


router.post('/register', validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/logout', jwtMiddleware, logoutUser);

module.exports = router;