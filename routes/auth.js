const express = require('express');
const router = express.Router();
const apiClient = require('../utils/apiClient');
const CryptoUtils = require('../utils/cryptoUtils');
const { requireGuest } = require('../utils/helpers');

// Login page
router.get('/login', requireGuest, (req, res) => {
  res.render('auth/login', {}, (err, html) => {
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
  res.render('auth/register', {}, (err, html) => {
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
    const { username, password } = req.body;
    
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

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
    res.render('auth/login', { error: error.message }, (err, html) => {
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
    const { username, email, password, confirmPassword } = req.body;
    
    if (!username || !email || !password || !confirmPassword) {
      throw new Error('All fields are required');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
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
