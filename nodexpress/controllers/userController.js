const User = require('../models/User');
const { generateToken, blacklistToken } = require('../middleware/auth');

const registerUser = async (req, res) => {
  try {
    const { username, email, password, first_name, last_name } = req.body;

    const existingUser = await User.findByUsernameOrEmail(username) || 
                         await User.findByEmail(email);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this username or email already exists'
      });
    }

    const newUser = await User.create({
      username,
      email,
      password,
      first_name,
      last_name
    });

    const token = generateToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: newUser.toJSON(),
        token,
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
      }
    });
  } catch (error) {
    console.error('Register User Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register user'
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findByUsernameOrEmail(username);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    const isValidPassword = await User.comparePassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token,
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
      }
    });
  } catch (error) {
    console.error('Login User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login'
    });
  }
};

const logoutUser = async (req, res) => {
  try {
    if (req.token) {
      blacklistToken(req.token);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user.toJSON()
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const result = await User.findAll(page, limit, search);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Get All Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.role !== 'admin' && req.user.id != id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.'
      });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: user.toJSON()
    });
  } catch (error) {
    console.error('Get User By ID Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user'
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (req.user.role !== 'admin' && req.user.id != id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.'
      });
    }

    if (req.user.role !== 'admin') {
      delete updateData.role;
      delete updateData.is_active;
    }

    delete updateData.password;

    const updatedUser = await User.updateById(id, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser.toJSON()
    });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update user'
    });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    await User.updatePassword(userId, current_password, new_password);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update Password Error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update password'
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    if (req.user.id == id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const deleted = await User.softDeleteById(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

const hardDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    if (req.user.id == id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const deleted = await User.deleteById(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User permanently deleted'
    });
  } catch (error) {
    console.error('Hard Delete User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete user'
    });
  }
};

const activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const user = await User.updateById(id, { is_active: true });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: user.toJSON()
    });
  } catch (error) {
    console.error('Activate User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate user'
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getProfile,
  getAllUsers,
  getUserById,
  updateUser,
  updatePassword,
  deleteUser,
  hardDeleteUser,
  activateUser
};