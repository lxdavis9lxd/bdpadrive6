function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

function requireGuest(req, res, next) {
  if (req.session.user) {
    return res.redirect('/explorer');
  }
  next();
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function validateTags(tags) {
  if (!Array.isArray(tags)) {
    throw new Error('Tags must be an array');
  }
  
  if (tags.length > 5) {
    throw new Error('Maximum of 5 tags allowed');
  }
  
  for (const tag of tags) {
    if (typeof tag !== 'string' || !/^[a-zA-Z0-9]+$/.test(tag)) {
      throw new Error('Tags must be alphanumeric words');
    }
  }
  
  return tags.map(tag => tag.toLowerCase());
}

function validateTextContent(text) {
  if (typeof text !== 'string') {
    throw new Error('Text content must be a string');
  }
  
  const maxSize = 10 * 1024; // 10KiB
  const textSize = Buffer.byteLength(text, 'utf8');
  
  if (textSize > maxSize) {
    throw new Error(`File content exceeds maximum size of ${formatFileSize(maxSize)}`);
  }
  
  return true;
}

function sortNodes(nodes, sortBy = 'name') {
  return nodes.sort((a, b) => {
    switch (sortBy) {
      case 'createdAt':
        return b.createdAt - a.createdAt;
      case 'modifiedAt':
        return b.modifiedAt - a.modifiedAt;
      case 'size':
        return (b.size || 0) - (a.size || 0);
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

function isSymlinkBroken(symlink, allNodes, username) {
  if (!symlink.contents || symlink.contents.length === 0) {
    return true; // Points to nothing
  }
  
  const targetId = symlink.contents[0];
  
  if (targetId === symlink.node_id) {
    return true; // Points to itself
  }
  
  const targetNode = allNodes.find(node => node.node_id === targetId);
  
  if (!targetNode) {
    return true; // Target doesn't exist
  }
  
  if (targetNode.owner !== username) {
    return true; // User doesn't own target
  }
  
  return false;
}

module.exports = {
  requireAuth,
  requireGuest,
  formatFileSize,
  formatDate,
  validateTags,
  validateTextContent,
  sortNodes,
  isSymlinkBroken
};
