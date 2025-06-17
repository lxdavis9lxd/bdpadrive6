const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const apiClient = require('../utils/apiClient');
const CryptoUtils = require('../utils/cryptoUtils');
const security = require('../utils/security');
const { requireGuest } = require('../utils/helpers');

// Password recovery token storage (in production, use database)
const resetTokens = new Map();

// Login page
router.get('/login', requireGuest, (req, res) => {
  res.render('auth/login', { error: null }, (err, html) => {
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

// Forgot password page
router.get('/forgot-password', requireGuest, (req, res) => {
  res.render('auth/forgot-password', { error: null, success: null }, (err, html) => {
    if (err) {
      console.error('Error rendering forgot password template:', err);
      return res.status(500).send('Error rendering page');
    }
    res.render('layout', { 
      title: 'Forgot Password - BDPADrive',
      user: null,
      content: html
    });
  });
});

// Reset password page
router.get('/reset-password/:token', requireGuest, (req, res) => {
  const { token } = req.params;
  
  if (!resetTokens.has(token)) {
    return res.render('auth/forgot-password', { 
      error: 'Invalid or expired reset token. Please request a new password reset.',
      success: null 
    }, (err, html) => {
      if (err) {
        console.error('Error rendering template:', err);
        return res.status(500).send('Error rendering page');
      }
      res.render('layout', { 
        title: 'Forgot Password - BDPADrive',
        user: null,
        content: html
      });
    });
  }

  res.render('auth/reset-password', { 
    token, 
    error: null 
  }, (err, html) => {
    if (err) {
      console.error('Error rendering reset password template:', err);
      return res.status(500).send('Error rendering page');
    }
    res.render('layout', { 
      title: 'Reset Password - BDPADrive',
      user: null,
      content: html
    });
  });
});

// Handle login
router.post('/login', 
  requireGuest,
  [
    body('username')
      .isLength({ min: 1 })
      .withMessage('Username is required')
      .customSanitizer(value => security.sanitizeText(value)),
    body('password')
      .isLength({ min: 1 })
      .withMessage('Password is required')
  ],
  security.handleValidationErrors,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      // Get user salt
      const userResponse = await apiClient.getUser(username);
      const { salt } = userResponse.user;

      // Derive key from password and salt
      const key = await CryptoUtils.deriveKey(password, salt);

      // Authenticate with API
      await apiClient.authenticateUser(username, key);

      // Store user session
      req.session.user = {
        username: username,
        clientId: CryptoUtils.generateClientId()
      };

      res.redirect('/explorer');
    } catch (error) {
      res.render('auth/login', { 
        error: error.message,
        success: null 
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
  }
);

// Handle registration
router.post('/register', 
  requireGuest,
  [
    ...security.getValidationRules().username,
    ...security.getValidationRules().email,
    ...security.getValidationRules().password,
    security.getValidationRules().password[0].custom((value, { req }) => {
      if (value !== req.body.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
  ],
  security.handleValidationErrors,
  async (req, res) => {
    try {
      const { username, email, password } = req.body;

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
  }
);

// Handle forgot password request
router.post('/forgot-password', 
  requireGuest,
  security.getValidationRules().email,
  security.handleValidationErrors,
  async (req, res) => {
    try {
      const { email } = req.body;
      
      // Generate secure reset token
      const resetToken = security.generateSecureToken(32);
      const expiry = Date.now() + (60 * 60 * 1000); // 1 hour expiry
      
      // Store token (in production, store in database)
      resetTokens.set(resetToken, {
        email: email,
        expires: expiry,
        used: false
      });
      
      // Clean up expired tokens
      setTimeout(() => {
        resetTokens.delete(resetToken);
      }, 60 * 60 * 1000);
      
      // Simulate sending email (as required by specs)
      console.log('\n=== PASSWORD RESET EMAIL SIMULATION ===');
      console.log(`To: ${email}`);
      console.log(`Subject: Reset Your BDPADrive Password`);
      console.log(`Reset Link: ${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`);
      console.log(`This link expires in 1 hour.`);
      console.log('======================================\n');
      
      res.render('auth/forgot-password', { 
        error: null,
        success: 'If an account with that email exists, a password reset link has been sent.'
      }, (err, html) => {
        if (err) {
          console.error('Error rendering template:', err);
          return res.status(500).send('Error rendering page');
        }
        res.render('layout', { 
          title: 'Forgot Password - BDPADrive',
          user: null,
          content: html
        });
      });
      
    } catch (error) {
      console.error('Password reset request error:', error);
      res.render('auth/forgot-password', { 
        error: 'An error occurred while processing your request.',
        success: null
      }, (err, html) => {
        if (err) {
          console.error('Error rendering template:', err);
          return res.status(500).send('Error rendering page');
        }
        res.render('layout', { 
          title: 'Forgot Password - BDPADrive',
          user: null,
          content: html
        });
      });
    }
  }
);

// Handle password reset
router.post('/reset-password/:token',
  requireGuest,
  security.getValidationRules().password,
  security.handleValidationErrors,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { password, confirmPassword } = req.body;
      
      if (!resetTokens.has(token)) {
        throw new Error('Invalid or expired reset token');
      }
      
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      const tokenData = resetTokens.get(token);
      
      if (tokenData.used || Date.now() > tokenData.expires) {
        resetTokens.delete(token);
        throw new Error('Reset token has expired');
      }
      
      // Mark token as used
      tokenData.used = true;
      
      // Note: In a real implementation, you would update the user's password here
      // For this demo, we'll just simulate the process
      console.log(`Password reset completed for email: ${tokenData.email}`);
      
      // Clean up token
      resetTokens.delete(token);
      
      res.render('auth/login', { 
        error: null,
        success: 'Your password has been reset successfully. Please log in with your new password.'
      }, (err, html) => {
        if (err) {
          console.error('Error rendering template:', err);
          return res.status(500).send('Error rendering page');
        }
        res.render('layout', { 
          title: 'Login - BDPADrive',
          user: null,
          content: html
        });
      });
      
    } catch (error) {
      res.render('auth/reset-password', { 
        token: req.params.token,
        error: error.message 
      }, (err, html) => {
        if (err) {
          console.error('Error rendering template:', err);
          return res.status(500).send('Error rendering page');
        }
        res.render('layout', { 
          title: 'Reset Password - BDPADrive',
          user: null,
          content: html
        });
      });
    }
  }
);

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
