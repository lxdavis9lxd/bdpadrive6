const express = require('express');
const router = express.Router();
const apiClient = require('../utils/apiClient');
const { requireAuth, formatFileSize, formatDate } = require('../utils/helpers');

// Search view
router.get('/', requireAuth, async (req, res) => {
  try {
    const { user } = req.session;
    const { q, type, tags, dateFrom, dateTo, sortBy = 'modifiedAt' } = req.query;
    
    let results = [];
    
    if (q || type || tags || dateFrom || dateTo) {
      // Get all user's nodes
      const response = await apiClient.searchNodes(user.username);
      let nodes = response.nodes || [];
      
      // Filter out null/undefined nodes
      nodes = nodes.filter(node => node && node.node_id);
      
      // Apply filters
      if (q) {
        const query = q.toLowerCase().trim();
        if (query) {
          nodes = nodes.filter(node => {
            // Search by name
            if (node.name && node.name.toLowerCase().includes(query)) return true;
            
            // Search by text content (for files)
            if (node.type === 'file' && node.text && node.text.toLowerCase().includes(query)) return true;
            
            // Search by tags
            if (node.tags && Array.isArray(node.tags)) {
              return node.tags.some(tag => tag && tag.toLowerCase().includes(query));
            }
            
            return false;
          });
        }
      }
      
      if (type && type !== 'all') {
        nodes = nodes.filter(node => node.type === type);
      }
      
      if (tags) {
        const searchTags = tags.split(',').map(tag => tag.trim().toLowerCase());
        nodes = nodes.filter(node => {
          if (!node.tags) return false;
          return searchTags.some(searchTag => 
            node.tags.some(nodeTag => nodeTag.toLowerCase().includes(searchTag))
          );
        });
      }
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime();
        nodes = nodes.filter(node => new Date(node.createdAt).getTime() >= fromDate);
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo).getTime() + (24 * 60 * 60 * 1000); // End of day
        nodes = nodes.filter(node => new Date(node.createdAt).getTime() <= toDate);
      }
      
      // Sort results - modification time for files, creation time for folders/symlinks
      nodes.sort((a, b) => {
        let aTime, bTime;
        
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else if (sortBy === 'size') {
          return (b.size || 0) - (a.size || 0);
        } else if (sortBy === 'createdAt') {
          aTime = new Date(a.createdAt).getTime();
          bTime = new Date(b.createdAt).getTime();
        } else { // modifiedAt (default)
          if (a.type === 'file') {
            aTime = new Date(a.modifiedAt || a.createdAt).getTime();
          } else {
            aTime = new Date(a.createdAt).getTime();
          }
          
          if (b.type === 'file') {
            bTime = new Date(b.modifiedAt || b.createdAt).getTime();
          } else {
            bTime = new Date(b.createdAt).getTime();
          }
        }
        
        return bTime - aTime; // Descending order
      });
      
      // Format results for display
      results = nodes.map(node => ({
        ...node,
        formattedSize: node.size ? formatFileSize(node.size) : '-',
        formattedCreatedAt: formatDate(node.createdAt),
        formattedModifiedAt: formatDate(node.modifiedAt || node.createdAt)
      }));
    }
    
    res.render('search/index', {
      title: 'Search - BDPADrive',
      user,
      results,
      query: { q, type, tags, dateFrom, dateTo, sortBy },
      resultCount: results.length
    });
  } catch (error) {
    res.render('search/index', {
      title: 'Search - BDPADrive',
      user: req.session.user,
      results: [],
      query: req.query,
      resultCount: 0,
      error: error.message
    });
  }
});

module.exports = router;
