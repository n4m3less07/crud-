const express = require('express');
const {
  getProfile,
  getAllUsers,
  getUserById,
  updateUser,
  updatePassword,
  deleteUser,
  hardDeleteUser,
  activateUser
} = require('../controllers/userController');
const {
  validateUserUpdate,
  validatePasswordUpdate,
  validateUserId
} = require('../middleware/validation.js');
const { jwtMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(jwtMiddleware);

router.get('/profile', getProfile);


router.put('/profile/password', validatePasswordUpdate, updatePassword);


router.get('/', adminMiddleware, getAllUsers);


router.get('/:id', validateUserId, getUserById);


router.put('/:id', validateUserId, validateUserUpdate, updateUser);


router.delete('/:id', adminMiddleware, validateUserId, deleteUser);

router.delete('/:id/hard', adminMiddleware, validateUserId, hardDeleteUser);


router.put('/:id/activate', adminMiddleware, validateUserId, activateUser);

module.exports = router;