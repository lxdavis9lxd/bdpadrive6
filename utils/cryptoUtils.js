const crypto = require('crypto');

class CryptoUtils {
  static async deriveKey(password, salt) {
    // Convert salt from hex string to buffer
    const saltBuffer = Buffer.from(salt, 'hex');
    
    // Derive key using PBKDF2
    const key = crypto.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha256');
    
    return key.toString('hex');
  }

  static generateSalt() {
    return crypto.randomBytes(16).toString('hex');
  }

  static generateClientId() {
    return crypto.randomBytes(16).toString('hex');
  }

  static validatePassword(password) {
    // Basic password validation
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    return true;
  }

  static validateUsername(username) {
    // Username can be alphanumeric with dashes and underscores
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!username || !usernameRegex.test(username)) {
      throw new Error('Username can only contain letters, numbers, dashes, and underscores');
    }
    if (username.length < 3 || username.length > 20) {
      throw new Error('Username must be between 3 and 20 characters long');
    }
    return true;
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    return true;
  }
}

module.exports = CryptoUtils;
