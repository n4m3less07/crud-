const bcrypt = require('bcryptjs');
const { executeQuery } = require('../utils/database');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.username = userData.username;
    this.email = userData.email;
    this.password = userData.password;
    this.first_name = userData.first_name;
    this.last_name = userData.last_name;
    this.role = userData.role || 'user';
    this.is_active = userData.is_active !== undefined ? userData.is_active : true;
    this.created_at = userData.created_at;
    this.updated_at = userData.updated_at;
  }

  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async create(userData) {
    try {
      const hashedPassword = await this.hashPassword(userData.password);
      
      const query = `
        INSERT INTO users (username, email, password, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await executeQuery(query, [
        userData.username,
        userData.email,
        hashedPassword,
        userData.first_name || null,
        userData.last_name || null,
        userData.role || 'user'
      ]);

      if (result.insertId) {
        return await this.findById(result.insertId);
      }
      
      throw new Error('Failed to create user');
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('username')) {
          throw new Error('Username already exists');
        } else if (error.sqlMessage.includes('email')) {
          throw new Error('Email already exists');
        }
      }
      throw error;
    }
  }

  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = ?';
      const results = await executeQuery(query, [id]);
      
      if (results.length > 0) {
        return new User(results[0]);
      }
      
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findByUsernameOrEmail(identifier) {
    try {
      const query = 'SELECT * FROM users WHERE username = ? OR email = ?';
      const results = await executeQuery(query, [identifier, identifier]);
      
      if (results.length > 0) {
        return new User(results[0]);
      }
      
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = ?';
      const results = await executeQuery(query, [email]);
      
      if (results.length > 0) {
        return new User(results[0]);
      }
      
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findAll(page = 1, limit = 10, search = '') {
    try {
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at
        FROM users
      `;
      let countQuery = 'SELECT COUNT(*) as total FROM users';
      let params = [];
      
      if (search) {
        query += ' WHERE username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?';
        countQuery += ' WHERE username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?';
        const searchParam = `%${search}%`;
        params = [searchParam, searchParam, searchParam, searchParam];
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const [users, totalResult] = await Promise.all([
        executeQuery(query, params),
        executeQuery(countQuery, search ? [search, search, search, search].map(s => `%${s}%`) : [])
      ]);
      
      return {
        users: users.map(user => new User(user)),
        total: totalResult[0].total,
        page,
        limit,
        totalPages: Math.ceil(totalResult[0].total / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  static async updateById(id, updateData) {
    try {
      const fields = [];
      const values = [];
      
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      values.push(id);
      
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      const result = await executeQuery(query, values);
      
      if (result.affectedRows > 0) {
        return await this.findById(id);
      }
      
      return null;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('username')) {
          throw new Error('Username already exists');
        } else if (error.sqlMessage.includes('email')) {
          throw new Error('Email already exists');
        }
      }
      throw error;
    }
  }

  static async updatePassword(id, currentPassword, newPassword) {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      const isValidPassword = await this.comparePassword(currentPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      const hashedNewPassword = await this.hashPassword(newPassword);
      await executeQuery('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, id]);
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async softDeleteById(id) {
    try {
      const result = await executeQuery(
        'UPDATE users SET is_active = false WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  static async deleteById(id) {
    try {
      const result = await executeQuery('DELETE FROM users WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  toProfile() {
    const { password, ...profile } = this;
    return profile;
  }

  toJSON() {
    const { password, ...userObject } = this;
    return userObject;
  }
}

module.exports = User;