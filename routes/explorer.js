const express = require('express');
const router = express.Router();
const apiClient = require('../utils/apiClient');
const cache = require('../utils/cache');
const pagination = require('../utils/pagination');
const security = require('../utils/security');
const { requireAuth, formatFileSize, formatDate, validateTags, validateTextContent, sortNodes, isSymlinkBroken } = require('../utils/helpers');

// Explorer view with pagination
router.get('/', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { sort = 'name', path = '', error, success } = req.query;
    const { page, limit, offset } = pagination.parseParams(req.query);
    
    // Generate cache key for this request
    const cacheKey = cache.searchKey(user.username, { sort, path, page, limit });
    
    // Try to get from cache first
    let cachedResult = cache.get(cacheKey);
    if (!cachedResult) {
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
      
      cachedResult = { nodes, currentDir };
      
      // Cache for 3 minutes
      cache.set(cacheKey, cachedResult, 180000);
    }
    
    const { nodes, currentDir } = cachedResult;
    
    // Apply pagination
    const baseUrl = `/explorer?sort=${sort}&path=${encodeURIComponent(path)}`;
    const paginatedResult = pagination.paginate(nodes, page, limit, baseUrl);
    
    // Build breadcrumb
    const breadcrumb = [];
    if (currentDir && path) {
      const pathParts = path.split('/').filter(part => part);
      let currentPath = '';
      
      pathParts.forEach(part => {
        currentPath += part;
        breadcrumb.push({
          name: part,
          path: currentPath
        });
        currentPath += '/';
      });
    }
    
    res.render('explorer/index', {
      title: 'File Explorer - BDPADrive',
      user,
      nodes: paginatedResult.items,
      pagination: paginatedResult.pagination,
      currentDir,
      breadcrumb,
      sort,
      path,
      error: error || null,
      success: success || null
    });
  } catch (err) {
    res.render('explorer/index', {
      title: 'File Explorer - BDPADrive',
      user: req.session.user,
      nodes: [],
      currentDir: null,
      sort: 'name',
      path: '',
      error: err.message,
      success: null
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

// Rename node
router.post('/rename/:nodeId', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    const { name, path = '' } = req.body;
    
    if (!name || !name.trim()) {
      throw new Error('Name is required');
    }
    
    // Get the node to check ownership
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      throw new Error('File or folder not found');
    }
    
    if (node.owner !== user.username) {
      throw new Error('You can only rename files and folders you own');
    }
    
    await apiClient.updateNode(user.username, nodeId, { name: name.trim() });
    
    res.redirect(`/explorer?path=${encodeURIComponent(path)}&success=${encodeURIComponent('Item renamed successfully')}`);
  } catch (error) {
    res.redirect(`/explorer?path=${encodeURIComponent(req.body.path || '')}&error=${encodeURIComponent(error.message)}`);
  }
});

// Change ownership
router.post('/change-owner/:nodeId', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    const { newOwner, path = '' } = req.body;
    
    if (!newOwner || !newOwner.trim()) {
      throw new Error('New owner username is required');
    }
    
    // Get the node to check ownership
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      throw new Error('File or folder not found');
    }
    
    if (node.owner !== user.username) {
      throw new Error('You can only change ownership of files and folders you own');
    }
    
    // Verify the new owner exists by trying to get their user data
    try {
      await apiClient.getUser(newOwner.trim());
    } catch (error) {
      throw new Error('Target user does not exist');
    }
    
    await apiClient.updateNode(user.username, nodeId, { owner: newOwner.trim() });
    
    res.redirect(`/explorer?path=${encodeURIComponent(path)}&success=${encodeURIComponent('Ownership changed successfully')}`);
  } catch (error) {
    res.redirect(`/explorer?path=${encodeURIComponent(req.body.path || '')}&error=${encodeURIComponent(error.message)}`);
  }
});

// Move node to folder
router.post('/move/:nodeId', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    const { targetFolderId, sourcePath = '', targetPath = '' } = req.body;
    
    // Get the node to check ownership
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      throw new Error('File or folder not found');
    }
    
    if (node.owner !== user.username) {
      throw new Error('You can only move files and folders you own');
    }
    
    // Remove from source folder if it's in one
    if (sourcePath) {
      const sourceResponse = await apiClient.getNodes(user.username, sourcePath);
      const sourceFolder = sourceResponse.nodes[0];
      
      if (sourceFolder && sourceFolder.type === 'directory') {
        const updatedContents = sourceFolder.contents.filter(id => id !== nodeId);
        await apiClient.updateNode(user.username, sourcePath, { contents: updatedContents });
      }
    }
    
    // Add to target folder if specified
    if (targetFolderId && targetFolderId !== 'root') {
      const targetResponse = await apiClient.getNodes(user.username, targetFolderId);
      const targetFolder = targetResponse.nodes[0];
      
      if (!targetFolder || targetFolder.type !== 'directory') {
        throw new Error('Target folder not found');
      }
      
      if (targetFolder.owner !== user.username) {
        throw new Error('You can only move items to folders you own');
      }
      
      const updatedContents = [...targetFolder.contents, nodeId];
      await apiClient.updateNode(user.username, targetFolderId, { contents: updatedContents });
    }
    
    res.redirect(`/explorer?path=${encodeURIComponent(targetPath)}&success=${encodeURIComponent('Item moved successfully')}`);
  } catch (error) {
    res.redirect(`/explorer?path=${encodeURIComponent(req.body.sourcePath || '')}&error=${encodeURIComponent(error.message)}`);
  }
});

// Update tags for file
router.post('/update-tags/:nodeId', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { nodeId } = req.params;
    const { tags, path = '' } = req.body;
    
    // Get the node to check ownership and type
    const response = await apiClient.getNodes(user.username, nodeId);
    const node = response.nodes[0];
    
    if (!node) {
      throw new Error('File not found');
    }
    
    if (node.type !== 'file') {
      throw new Error('Tags can only be added to files');
    }
    
    if (node.owner !== user.username) {
      throw new Error('You can only modify tags on files you own');
    }
    
    // Validate and process tags
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const validatedTags = validateTags(tagArray);
    
    await apiClient.updateNode(user.username, nodeId, { tags: validatedTags });
    
    res.redirect(`/explorer?path=${encodeURIComponent(path)}&success=${encodeURIComponent('Tags updated successfully')}`);
  } catch (error) {
    res.redirect(`/explorer?path=${encodeURIComponent(req.body.path || '')}&error=${encodeURIComponent(error.message)}`);
  }
});

module.exports = router;
