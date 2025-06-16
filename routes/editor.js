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
    
    // Check if user has lock or if there's a conflict
    const now = Date.now();
    const lockTimeout = 5 * 60 * 1000; // 5 minutes lock timeout
    
    if (node.lock) {
      // Check if lock is expired
      if (now - node.lock.createdAt > lockTimeout) {
        // Lock expired, remove it
        await apiClient.updateNode(user.username, nodeId, { lock: null });
      } else if (node.lock.user !== user.username || node.lock.client !== user.clientId) {
        // Someone else has the lock
        const lockOwner = node.lock.user === user.username ? 'another tab' : 'another user';
        const timeRemaining = Math.ceil((lockTimeout - (now - node.lock.createdAt)) / (60 * 1000));
        throw new Error(`This file is being edited by ${lockOwner}. Lock expires in ${timeRemaining} minutes.`);
      }
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

// Release lock on file
router.post('/:nodeId/release-lock', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    
    // Get the file node
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      return res.json({ error: 'File not found' });
    }
    
    if (node.owner !== user.username) {
      return res.json({ error: 'You can only release locks on files you own' });
    }
    
    // Check if user owns the lock
    if (node.lock && node.lock.user === user.username && node.lock.client === user.clientId) {
      await apiClient.updateNode(user.username, nodeId, { lock: null });
      res.json({ success: true });
    } else {
      res.json({ error: 'You do not own the lock on this file' });
    }
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Auto-save endpoint
router.post('/:nodeId/autosave', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    const { text, tags } = req.body;
    
    // Get current file to check lock
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      return res.json({ error: 'File not found' });
    }
    
    if (node.owner !== user.username) {
      return res.json({ error: 'You can only edit files you own' });
    }
    
    // Check lock with conflict detection
    const now = Date.now();
    const lockTimeout = 5 * 60 * 1000; // 5 minutes
    
    if (node.lock) {
      if (now - node.lock.createdAt > lockTimeout) {
        // Lock expired, try to acquire new lock
        const lockData = {
          lock: {
            user: user.username,
            client: user.clientId,
            createdAt: now
          }
        };
        await apiClient.updateNode(user.username, nodeId, lockData);
      } else if (node.lock.user !== user.username || node.lock.client !== user.clientId) {
        return res.json({ 
          error: 'File is locked by another session',
          conflict: true,
          lockOwner: node.lock.user === user.username ? 'another tab' : 'another user'
        });
      }
    } else {
      // No lock, acquire it
      const lockData = {
        lock: {
          user: user.username,
          client: user.clientId,
          createdAt: now
        }
      };
      await apiClient.updateNode(user.username, nodeId, lockData);
    }
    
    // Validate and save
    validateTextContent(text);
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const validatedTags = validateTags(tagArray);
    
    await apiClient.updateNode(user.username, nodeId, {
      text,
      tags: validatedTags
    });
    
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Check lock status for conflict detection
router.get('/:nodeId/check-lock', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      return res.json({ error: 'File not found' });
    }
    
    if (node.lock && (node.lock.user !== user.username || node.lock.client !== user.clientId)) {
      const now = Date.now();
      const lockTimeout = 5 * 60 * 1000; // 5 minutes
      
      if (now - node.lock.createdAt < lockTimeout) {
        return res.json({ 
          conflict: true, 
          lock: node.lock 
        });
      }
    }
    
    res.json({ conflict: false });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Force take lock
router.post('/:nodeId/force-lock', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    
    const lockData = {
      lock: {
        user: user.username,
        client: user.clientId,
        createdAt: Date.now()
      }
    };
    
    await apiClient.updateNode(user.username, nodeId, lockData);
    res.json({ success: true });
  } catch (error) {
    res.json({ error: error.message });
  }
});

module.exports = router;
