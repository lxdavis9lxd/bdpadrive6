const express = require('express');
const router = express.Router();
const apiClient = require('../utils/apiClient');
const CryptoUtils = require('../utils/cryptoUtils');
const { requireAuth, formatFileSize } = require('../utils/helpers');

// Dashboard view
router.get('/', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    
    // Get user details
    const userResponse = await apiClient.getUser(user.username);
    const userData = userResponse.user;
    
    // Get all user's files to calculate storage usage
    const filesResponse = await apiClient.searchNodes(user.username, {
      match: { type: 'file' }
    });
    
    const files = filesResponse.nodes || [];
    const totalStorage = files.reduce((total, file) => total + (file.size || 0), 0);
    
    res.render('dashboard/index', {
      title: 'Dashboard - BDPADrive',
      user,
      userData,
      totalStorage: formatFileSize(totalStorage),
      fileCount: files.length,
      error: null,
      success: null
    });
  } catch (error) {
    res.render('dashboard/index', {
      title: 'Dashboard - BDPADrive',
      user: req.session.user,
      userData: null,
      totalStorage: '0 B',
      fileCount: 0,
      error: error.message,
      success: null
    });
  }
});

// Update email
router.post('/update-email', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { email } = req.body;
    
    if (!email) {
      throw new Error('Email is required');
    }
    
    CryptoUtils.validateEmail(email);
    
    await apiClient.updateUser(user.username, { email });
    
    // Get updated user data
    const userResponse = await apiClient.getUser(user.username);
    const userData = userResponse.user;
    
    // Get storage info
    const filesResponse = await apiClient.searchNodes(user.username, {
      match: { type: 'file' }
    });
    
    const files = filesResponse.nodes || [];
    const totalStorage = files.reduce((total, file) => total + (file.size || 0), 0);
    
    res.render('dashboard/index', {
      title: 'Dashboard - BDPADrive',
      user,
      userData,
      totalStorage: formatFileSize(totalStorage),
      fileCount: files.length,
      error: null,
      success: 'Email updated successfully!'
    });
  } catch (error) {
    // Re-fetch data for rendering
    try {
      const userResponse = await apiClient.getUser(req.session.user.username);
      const userData = userResponse.user;
      
      const filesResponse = await apiClient.searchNodes(req.session.user.username, {
        match: { type: 'file' }
      });
      
      const files = filesResponse.nodes || [];
      const totalStorage = files.reduce((total, file) => total + (file.size || 0), 0);
      
      res.render('dashboard/index', {
        title: 'Dashboard - BDPADrive',
        user: req.session.user,
        userData,
        totalStorage: formatFileSize(totalStorage),
        fileCount: files.length,
        error: error.message,
        success: null
      });
    } catch (fetchError) {
      res.render('dashboard/index', {
        title: 'Dashboard - BDPADrive',
        user: req.session.user,
        userData: null,
        totalStorage: '0 B',
        fileCount: 0,
        error: error.message,
        success: null
      });
    }
  }
});

// Change password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error('All password fields are required');
    }
    
    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match');
    }
    
    CryptoUtils.validatePassword(newPassword);
    
    // Get current user data
    const userResponse = await apiClient.getUser(user.username);
    const userData = userResponse.user;
    
    // Verify current password
    const currentKey = await CryptoUtils.deriveKey(currentPassword, userData.salt);
    await apiClient.authenticateUser(user.username, currentKey);
    
    // Generate new salt and key
    const newSalt = CryptoUtils.generateSalt();
    const newKey = await CryptoUtils.deriveKey(newPassword, newSalt);
    
    await apiClient.updateUser(user.username, {
      salt: newSalt,
      key: newKey
    });
    
    // Get updated user data
    const updatedUserResponse = await apiClient.getUser(user.username);
    const updatedUserData = updatedUserResponse.user;
    
    // Get storage info
    const filesResponse = await apiClient.searchNodes(user.username, {
      match: { type: 'file' }
    });
    
    const files = filesResponse.nodes || [];
    const totalStorage = files.reduce((total, file) => total + (file.size || 0), 0);
    
    res.render('dashboard/index', {
      title: 'Dashboard - BDPADrive',
      user,
      userData: updatedUserData,
      totalStorage: formatFileSize(totalStorage),
      fileCount: files.length,
      error: null,
      success: 'Password changed successfully!'
    });
  } catch (error) {
    // Re-fetch data for rendering
    try {
      const userResponse = await apiClient.getUser(req.session.user.username);
      const userData = userResponse.user;
      
      const filesResponse = await apiClient.searchNodes(req.session.user.username, {
        match: { type: 'file' }
      });
      
      const files = filesResponse.nodes || [];
      const totalStorage = files.reduce((total, file) => total + (file.size || 0), 0);
      
      res.render('dashboard/index', {
        title: 'Dashboard - BDPADrive',
        user: req.session.user,
        userData,
        totalStorage: formatFileSize(totalStorage),
        fileCount: files.length,
        error: error.message,
        success: null
      });
    } catch (fetchError) {
      res.render('dashboard/index', {
        title: 'Dashboard - BDPADrive',
        user: req.session.user,
        userData: null,
        totalStorage: '0 B',
        fileCount: 0,
        error: error.message,
        success: null
      });
    }
  }
});

// Delete account
router.post('/delete-account', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { password, confirmDelete } = req.body;
    
    if (!password) {
      throw new Error('Password is required to delete account');
    }
    
    if (confirmDelete !== 'DELETE') {
      throw new Error('Please type DELETE to confirm account deletion');
    }
    
    // Verify password
    const userResponse = await apiClient.getUser(user.username);
    const userData = userResponse.user;
    
    const key = await CryptoUtils.deriveKey(password, userData.salt);
    await apiClient.authenticateUser(user.username, key);
    
    // Delete all user's files first
    const filesResponse = await apiClient.searchNodes(user.username);
    const nodes = filesResponse.nodes || [];
    
    if (nodes.length > 0) {
      const nodeIds = nodes.map(node => node.node_id);
      await apiClient.deleteNodes(user.username, nodeIds);
    }
    
    // Delete user account
    await apiClient.deleteUser(user.username);
    
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.redirect('/auth/login?message=Account deleted successfully');
    });
  } catch (error) {
    // Re-fetch data for rendering
    try {
      const userResponse = await apiClient.getUser(req.session.user.username);
      const userData = userResponse.user;
      
      const filesResponse = await apiClient.searchNodes(req.session.user.username, {
        match: { type: 'file' }
      });
      
      const files = filesResponse.nodes || [];
      const totalStorage = files.reduce((total, file) => total + (file.size || 0), 0);
      
      res.render('dashboard/index', {
        title: 'Dashboard - BDPADrive',
        user: req.session.user,
        userData,
        totalStorage: formatFileSize(totalStorage),
        fileCount: files.length,
        error: error.message,
        success: null
      });
    } catch (fetchError) {
      res.render('dashboard/index', {
        title: 'Dashboard - BDPADrive',
        user: req.session.user,
        userData: null,
        totalStorage: '0 B',
        fileCount: 0,
        error: error.message,
        success: null
      });
    }
  }
});

module.exports = router;
