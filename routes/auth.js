const express = require('express');
const router = express.Router();
const apiClient = require('../utils/apiClient');
const CryptoUtils = require('../utils/cryptoUtils');
const { requireGuest } = require('../utils/helpers');

// In-memory store for login attempts (in production, use Redis or database)
const loginAttempts = new Map();

// Helper function to check if user is locked out
function isLockedOut(username) {
  const attempts = loginAttempts.get(username);
  if (!attempts) return false;
  
  const now = Date.now();
  const lockoutTime = 60 * 60 * 1000; // 1 hour in milliseconds
  
  if (attempts.count >= 3 && (now - attempts.lastAttempt) < lockoutTime) {
    return {
      locked: true,
      remainingTime: Math.ceil((lockoutTime - (now - attempts.lastAttempt)) / (60 * 1000)) // minutes
    };
  }
  
  // Reset attempts if lockout period has passed
  if (attempts.count >= 3 && (now - attempts.lastAttempt) >= lockoutTime) {
    loginAttempts.delete(username);
  }
  
  return false;
}

// Helper function to record failed login attempt
function recordFailedAttempt(username) {
  const now = Date.now();
  const attempts = loginAttempts.get(username) || { count: 0, lastAttempt: 0 };
  
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(username, attempts);
  
  return {
    count: attempts.count,
    remaining: Math.max(0, 3 - attempts.count)
  };
}

// Helper function to clear login attempts on successful login
function clearFailedAttempts(username) {
  loginAttempts.delete(username);
}

// Helper function to get remaining lockout time
function getRemainingLockoutTime(username) {
  const attempts = loginAttempts.get(username);
  if (!attempts || attempts.count < 3) return 0;
  
  const now = Date.now();
  const lockoutTime = 60 * 60 * 1000; // 1 hour in milliseconds
  const timePassed = now - attempts.lastAttempt;
  
  if (timePassed >= lockoutTime) {
    return 0;
  }
  
  return Math.ceil((lockoutTime - timePassed) / (60 * 1000)); // minutes
}

// Get remaining attempts for a user
function getRemainingAttempts(username) {
  const attempts = loginAttempts.get(username);
  if (!attempts) return 3;
  
  const lockoutTime = getRemainingLockoutTime(username);
  if (lockoutTime > 0) return 0; // Locked out
  
  return Math.max(0, 3 - attempts.count);
}

// Login page
router.get('/login', requireGuest, (req, res) => {
  const username = req.query.username;
  let warningMessage = null;
  
  if (username) {
    const remainingAttempts = getRemainingAttempts(username);
    const lockoutTime = getRemainingLockoutTime(username);
    
    if (lockoutTime > 0) {
      warningMessage = `Account locked due to too many failed attempts. Try again in ${lockoutTime} minutes.`;
    } else if (remainingAttempts < 3 && remainingAttempts > 0) {
      warningMessage = `Warning: ${remainingAttempts} login attempts remaining.`;
    }
  }
  
  res.render('auth/login', { error: null, warning: warningMessage, username: username || '' }, (err, html) => {
    if (err) {
      console.error('Error rendering login template:', err);
      return res.status(500).send('Error rendering page');
    }
    res.render('layout', { 
      title: 'Login - BDPADrive',
      user: null,
      content: html
    });
  });
});

// Register page  
router.get('/register', requireGuest, (req, res) => {
  res.render('auth/register', { error: null }, (err, html) => {
    if (err) {
      console.error('Error rendering register template:', err);
      return res.status(500).send('Error rendering page');
    }
    res.render('layout', { 
      title: 'Register - BDPADrive',
      user: null,
      content: html
    });
  });
});

// Handle login
router.post('/login', requireGuest, async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Check if user is locked out
    const lockoutStatus = isLockedOut(username);
    if (lockoutStatus.locked) {
      throw new Error(`Too many failed login attempts. Please try again in ${lockoutStatus.remainingTime} minutes.`);
    }

    // Get user salt
    const userResponse = await apiClient.getUser(username);
    const { salt } = userResponse.user;

    // Derive key from password and salt
    const key = await CryptoUtils.deriveKey(password, salt);

    // Authenticate with API
    await apiClient.authenticateUser(username, key);

    // Clear any failed login attempts
    clearFailedAttempts(username);

    // Store user session
    req.session.user = {
      username: username,
      clientId: CryptoUtils.generateClientId()
    };
    
    // Handle remember me functionality
    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    res.redirect('/explorer');
  } catch (error) {
    // Record failed attempt if it was an authentication error
    let attemptsInfo = null;
    if (error.message.includes('Invalid credentials') || error.message.includes('User not found')) {
      const attempts = recordFailedAttempt(username);
      attemptsInfo = attempts;
    }
    
    // Create error message with attempt info
    let errorMessage = error.message;
    if (attemptsInfo && attemptsInfo.remaining > 0) {
      errorMessage += ` (${attemptsInfo.remaining} attempts remaining)`;
    } else if (attemptsInfo && attemptsInfo.remaining === 0) {
      errorMessage = 'Too many failed login attempts. Account locked for 1 hour.';
    }
    
    res.render('auth/login', { 
      error: errorMessage, 
      warning: null, 
      username: username || '' 
    }, (err, html) => {
      if (err) {
        console.error('Error rendering login template:', err);
        return res.status(500).send('Error rendering page');
      }
      res.render('layout', { 
        title: 'Login - BDPADrive',
        user: null,
        content: html
      });
    });
  }
});

// Handle registration
router.post('/register', requireGuest, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, captchaAnswer, captchaExpected } = req.body;
    
    if (!username || !email || !password || !confirmPassword || !captchaAnswer || !captchaExpected) {
      throw new Error('All fields are required');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    
    // Validate CAPTCHA
    if (parseInt(captchaAnswer) !== parseInt(captchaExpected)) {
      throw new Error('Security challenge answer is incorrect');
    }
    
    // Validate password strength
    if (password.length <= 10) {
      throw new Error('Password is too weak. Please use at least 11 characters.');
    }

    // Validate input
    CryptoUtils.validateUsername(username);
    CryptoUtils.validateEmail(email);
    CryptoUtils.validatePassword(password);

    // Generate salt and derive key
    const salt = CryptoUtils.generateSalt();
    const key = await CryptoUtils.deriveKey(password, salt);

    // Create user via API
    const userData = {
      username,
      email,
      salt,
      key
    };

    await apiClient.createUser(userData);

    // Store user session
    req.session.user = {
      username: username,
      clientId: CryptoUtils.generateClientId()
    };

    res.redirect('/explorer');
  } catch (error) {
    res.render('auth/register', { error: error.message }, (err, html) => {
      if (err) {
        console.error('Error rendering register template:', err);
        return res.status(500).send('Error rendering page');
      }
      res.render('layout', { 
        title: 'Register - BDPADrive',
        user: null,
        content: html
      });
    });
  }
});

// Handle logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/auth/login');
  });
});

module.exports = router;
