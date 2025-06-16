const express = require('express');
const router = express.Router();
const apiClient = require('../utils/apiClient');
const { requireAuth, formatFileSize, formatDate, validateTags, validateTextContent, sortNodes, isSymlinkBroken } = require('../utils/helpers');

// Explorer view
router.get('/', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { sort = 'name', path = '' } = req.query;
    
    // Get all user's nodes
    const response = await apiClient.searchNodes(user.username);
    let nodes = response.nodes || [];
    
    // Current directory node
    let currentDir = null;
    if (path) {
      const dirResponse = await apiClient.getNodes(user.username, path);
      currentDir = dirResponse.nodes[0];
      
      if (!currentDir || currentDir.type !== 'directory') {
        throw new Error('Directory not found');
      }
      
      // Filter nodes to show only contents of current directory
      nodes = nodes.filter(node => currentDir.contents.includes(node.node_id));
    } else {
      // Show root level nodes (not contained in any directory)
      const allDirs = nodes.filter(node => node.type === 'directory');
      const allContainedNodeIds = new Set();
      
      allDirs.forEach(dir => {
        dir.contents.forEach(nodeId => allContainedNodeIds.add(nodeId));
      });
      
      nodes = nodes.filter(node => !allContainedNodeIds.has(node.node_id));
    }
    
    // Sort nodes
    nodes = sortNodes(nodes, sort);
    
    // Add additional properties for display
    nodes = nodes.map(node => ({
      ...node,
      formattedSize: node.size ? formatFileSize(node.size) : '-',
      formattedCreatedAt: formatDate(node.createdAt),
      formattedModifiedAt: formatDate(node.modifiedAt || node.createdAt),
      isBroken: node.type === 'symlink' ? isSymlinkBroken(node, response.nodes, user.username) : false
    }));
    
    res.render('explorer/index', {
      title: 'File Explorer - BDPADrive',
      user,
      nodes,
      currentDir,
      sort,
      path,
      error: null
    });
  } catch (error) {
    res.render('explorer/index', {
      title: 'File Explorer - BDPADrive',
      user: req.session.user,
      nodes: [],
      currentDir: null,
      sort: 'name',
      path: '',
      error: error.message
    });
  }
});

// Create new file form
router.get('/new-file', requireAuth, (req, res) => {
  const { path = '' } = req.query;
  res.render('explorer/new-file', {
    title: 'New File - BDPADrive',
    user: req.session.user,
    path,
    error: null
  });
});

// Create new folder form
router.get('/new-folder', requireAuth, (req, res) => {
  const { path = '' } = req.query;
  res.render('explorer/new-folder', {
    title: 'New Folder - BDPADrive',
    user: req.session.user,
    path,
    error: null
  });
});

// Create new symlink form
router.get('/new-symlink', requireAuth, async (req, res) => {
  try {
    const { path = '' } = req.query;
    const { user } = req.session;
    
    // Get all user's nodes for symlink target selection
    const response = await apiClient.searchNodes(user.username);
    const nodes = response.nodes || [];
    
    res.render('explorer/new-symlink', {
      title: 'New Symlink - BDPADrive',
      user,
      path,
      nodes,
      error: null
    });
  } catch (error) {
    res.render('explorer/new-symlink', {
      title: 'New Symlink - BDPADrive',
      user: req.session.user,
      path: '',
      nodes: [],
      error: error.message
    });
  }
});

// Handle file creation
router.post('/new-file', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { name, tags, text, path = '' } = req.body;
    
    if (!name) {
      throw new Error('File name is required');
    }
    
    // Validate and process tags
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const validatedTags = validateTags(tagArray);
    
    // Validate text content
    validateTextContent(text || '');
    
    // Create file node
    const fileData = {
      type: 'file',
      name: name.trim(),
      text: text || '',
      tags: validatedTags
    };
    
    const response = await apiClient.createNode(user.username, fileData);
    
    // If we're in a directory, add this file to it
    if (path) {
      const dirResponse = await apiClient.getNodes(user.username, path);
      const dir = dirResponse.nodes[0];
      
      if (dir && dir.type === 'directory') {
        const updatedContents = [...dir.contents, response.node.node_id];
        await apiClient.updateNode(user.username, path, { contents: updatedContents });
      }
    }
    
    res.redirect(`/explorer?path=${encodeURIComponent(path)}`);
  } catch (error) {
    res.render('explorer/new-file', {
      title: 'New File - BDPADrive',
      user: req.session.user,
      path: req.body.path || '',
      error: error.message
    });
  }
});

// Handle folder creation
router.post('/new-folder', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { name, path = '' } = req.body;
    
    if (!name) {
      throw new Error('Folder name is required');
    }
    
    // Create directory node
    const folderData = {
      type: 'directory',
      name: name.trim(),
      contents: []
    };
    
    const response = await apiClient.createNode(user.username, folderData);
    
    // If we're in a directory, add this folder to it
    if (path) {
      const dirResponse = await apiClient.getNodes(user.username, path);
      const dir = dirResponse.nodes[0];
      
      if (dir && dir.type === 'directory') {
        const updatedContents = [...dir.contents, response.node.node_id];
        await apiClient.updateNode(user.username, path, { contents: updatedContents });
      }
    }
    
    res.redirect(`/explorer?path=${encodeURIComponent(path)}`);
  } catch (error) {
    res.render('explorer/new-folder', {
      title: 'New Folder - BDPADrive',
      user: req.session.user,
      path: req.body.path || '',
      error: error.message
    });
  }
});

// Handle symlink creation
router.post('/new-symlink', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { name, targetId, path = '' } = req.body;
    
    if (!name || !targetId) {
      throw new Error('Symlink name and target are required');
    }
    
    // Create symlink node
    const symlinkData = {
      type: 'symlink',
      name: name.trim(),
      contents: [targetId]
    };
    
    const response = await apiClient.createNode(user.username, symlinkData);
    
    // If we're in a directory, add this symlink to it
    if (path) {
      const dirResponse = await apiClient.getNodes(user.username, path);
      const dir = dirResponse.nodes[0];
      
      if (dir && dir.type === 'directory') {
        const updatedContents = [...dir.contents, response.node.node_id];
        await apiClient.updateNode(user.username, path, { contents: updatedContents });
      }
    }
    
    res.redirect(`/explorer?path=${encodeURIComponent(path)}`);
  } catch (error) {
    // Re-fetch nodes for the form
    try {
      const response = await apiClient.searchNodes(req.session.user.username);
      const nodes = response.nodes || [];
      
      res.render('explorer/new-symlink', {
        title: 'New Symlink - BDPADrive',
        user: req.session.user,
        path: req.body.path || '',
        nodes,
        error: error.message
      });
    } catch (fetchError) {
      res.render('explorer/new-symlink', {
        title: 'New Symlink - BDPADrive',
        user: req.session.user,
        path: req.body.path || '',
        nodes: [],
        error: error.message
      });
    }
  }
});

// Delete node
router.post('/delete/:nodeId', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    const { path = '' } = req.body;
    
    await apiClient.deleteNodes(user.username, nodeId);
    
    // If we're in a directory, remove this node from it
    if (path) {
      const dirResponse = await apiClient.getNodes(user.username, path);
      const dir = dirResponse.nodes[0];
      
      if (dir && dir.type === 'directory') {
        const updatedContents = dir.contents.filter(id => id !== nodeId);
        await apiClient.updateNode(user.username, path, { contents: updatedContents });
      }
    }
    
    res.redirect(`/explorer?path=${encodeURIComponent(path)}`);
  } catch (error) {
    res.redirect(`/explorer?path=${encodeURIComponent(req.body.path || '')}&error=${encodeURIComponent(error.message)}`);
  }
});

module.exports = router;
