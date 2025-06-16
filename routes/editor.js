const express = require('express');
const router = express.Router();
const apiClient = require('../utils/apiClient');
const { requireAuth, validateTags, validateTextContent } = require('../utils/helpers');

// Editor view for file
router.get('/:nodeId', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    
    // Get the file node
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      throw new Error('File not found');
    }
    
    if (node.type !== 'file') {
      throw new Error('Can only edit text files');
    }
    
    if (node.owner !== user.username) {
      throw new Error('You can only edit files you own');
    }
    
    // Set lock on the file
    const lockData = {
      lock: {
        user: user.username,
        client: user.clientId,
        createdAt: Date.now()
      }
    };
    
    await apiClient.updateNode(user.username, nodeId, lockData);
    
    res.render('editor/index', {
      title: `Edit ${node.name} - BDPADrive`,
      user,
      node,
      error: null,
      success: null
    });
  } catch (error) {
    res.render('error', {
      title: 'Error - BDPADrive',
      message: error.message,
      user: req.session.user
    });
  }
});

// Save file changes
router.post('/:nodeId/save', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    const { text, tags, name } = req.body;
    
    // Get current file to check lock
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      throw new Error('File not found');
    }
    
    if (node.owner !== user.username) {
      throw new Error('You can only edit files you own');
    }
    
    // Check if user has lock
    if (!node.lock || node.lock.user !== user.username || node.lock.client !== user.clientId) {
      throw new Error('You do not have a lock on this file');
    }
    
    // Validate input
    validateTextContent(text);
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const validatedTags = validateTags(tagArray);
    
    // Update file
    const updateData = {
      text,
      tags: validatedTags
    };
    
    if (name && name.trim() !== node.name) {
      updateData.name = name.trim();
    }
    
    await apiClient.updateNode(user.username, nodeId, updateData);
    
    // Get updated node
    const updatedResponse = await apiClient.getNodes(user.username, nodeId);
    const updatedNode = updatedResponse.nodes[0];
    
    res.render('editor/index', {
      title: `Edit ${updatedNode.name} - BDPADrive`,
      user,
      node: updatedNode,
      error: null,
      success: 'File saved successfully!'
    });
  } catch (error) {
    // Get current node for re-rendering
    try {
      const response = await apiClient.getNodes(req.session.user.username, req.params.nodeId);
      const node = response.nodes[0];
      
      res.render('editor/index', {
        title: `Edit ${node.name} - BDPADrive`,
        user: req.session.user,
        node,
        error: error.message,
        success: null
      });
    } catch (fetchError) {
      res.render('error', {
        title: 'Error - BDPADrive',
        message: error.message,
        user: req.session.user
      });
    }
  }
});

// Delete file
router.post('/:nodeId/delete', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    
    // Get the file to check ownership
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      throw new Error('File not found');
    }
    
    if (node.owner !== user.username) {
      throw new Error('You can only delete files you own');
    }
    
    await apiClient.deleteNodes(user.username, nodeId);
    
    res.redirect('/explorer');
  } catch (error) {
    res.redirect(`/editor/${req.params.nodeId}?error=${encodeURIComponent(error.message)}`);
  }
});

// Release lock
router.post('/:nodeId/release-lock', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    
    // Remove lock from file
    await apiClient.updateNode(user.username, nodeId, { lock: null });
    
    res.redirect('/explorer');
  } catch (error) {
    res.redirect(`/editor/${nodeId}?error=${encodeURIComponent(error.message)}`);
  }
});

module.exports = router;
