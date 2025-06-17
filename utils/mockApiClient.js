const cache = require('./cache');

class MockAPIClient {
  constructor() {
    // Mock data storage
    this.users = new Map();
    this.nodes = new Map();
    this.userNodes = new Map(); // username -> Set of nodeIds
    
    // Initialize with some demo data
    this.initializeDemoData();
  }

  initializeDemoData() {
    // Create demo user
    const demoUser = {
      username: 'demo',
      email: 'demo@bdpadrive.com',
      salt: 'demo-salt',
      key: 'demo-key-hash',
      createdAt: new Date().toISOString()
    };
    this.users.set('demo', demoUser);
    this.userNodes.set('demo', new Set());

    // Create some demo files/folders
    const demoNodes = [
      {
        id: 'node1',
        name: 'Documents',
        type: 'directory',
        owner: 'demo',
        path: '/Documents',
        parentId: null,
        contents: ['node2', 'node3'],
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      },
      {
        id: 'node2',
        name: 'Welcome.md',
        type: 'file',
        owner: 'demo',
        path: '/Documents/Welcome.md',
        parentId: 'node1',
        contents: '# Welcome to BDPADrive\n\nThis is your secure file storage system.',
        size: 62,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      },
      {
        id: 'node3',
        name: 'Projects',
        type: 'directory',
        owner: 'demo',
        path: '/Documents/Projects',
        parentId: 'node1',
        contents: [],
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      }
    ];

    demoNodes.forEach(node => {
      this.nodes.set(node.id, node);
      this.userNodes.get('demo').add(node.id);
    });
  }

  // Simulate network delay
  async delay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // User endpoints
  async createUser(userData) {
    await this.delay();
    
    if (this.users.has(userData.username)) {
      throw new Error('Username already exists');
    }

    const user = {
      ...userData,
      createdAt: new Date().toISOString()
    };

    this.users.set(userData.username, user);
    this.userNodes.set(userData.username, new Set());

    return { success: true, user: { username: user.username, email: user.email } };
  }

  async getUser(username) {
    await this.delay();
    
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    return { 
      user: { 
        username: user.username, 
        email: user.email, 
        salt: user.salt,
        createdAt: user.createdAt
      } 
    };
  }

  async updateUser(username, userData) {
    await this.delay();
    
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    Object.assign(user, userData);
    this.users.set(username, user);

    return { success: true };
  }

  async deleteUser(username) {
    await this.delay();
    
    if (!this.users.has(username)) {
      throw new Error('User not found');
    }

    this.users.delete(username);
    this.userNodes.delete(username);

    return { success: true };
  }

  async authenticateUser(username, key) {
    await this.delay();
    
    const user = this.users.get(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    // In a real implementation, you'd verify the key properly
    // For demo purposes, we'll just check if user exists
    return { success: true };
  }

  // Password recovery endpoints
  async requestPasswordReset(email) {
    await this.delay();
    
    // Find user by email
    for (const [username, user] of this.users) {
      if (user.email === email) {
        return { success: true, message: 'Password reset email sent' };
      }
    }
    
    throw new Error('Email not found');
  }

  async resetPassword(token, newPassword) {
    await this.delay();
    
    // In a real implementation, you'd validate the token
    return { success: true };
  }

  // Filesystem endpoints
  async searchNodes(username, query = {}) {
    await this.delay();
    
    const userNodeIds = this.userNodes.get(username);
    if (!userNodeIds) {
      return { nodes: [] };
    }

    const nodes = Array.from(userNodeIds).map(id => this.nodes.get(id)).filter(Boolean);
    
    // Apply pagination if specified
    let result = nodes;
    if (query.after) {
      const afterIndex = nodes.findIndex(n => n.id === query.after);
      result = afterIndex >= 0 ? nodes.slice(afterIndex + 1) : [];
    }

    return { nodes: result };
  }

  async getNodes(username, nodeId) {
    await this.delay();
    
    // If nodeId is null or empty, return root nodes
    if (!nodeId) {
      const userNodeIds = this.userNodes.get(username);
      if (!userNodeIds) {
        return { nodes: [] };
      }
      
      const rootNodes = Array.from(userNodeIds)
        .map(id => this.nodes.get(id))
        .filter(node => node && !node.parentId);
      
      return { nodes: rootNodes };
    }

    const node = this.nodes.get(nodeId);
    if (!node || node.owner !== username) {
      throw new Error('Node not found');
    }

    if (node.type === 'directory' && Array.isArray(node.contents)) {
      const childNodes = node.contents.map(id => this.nodes.get(id)).filter(Boolean);
      return { nodes: childNodes };
    }

    return { nodes: [node] };
  }

  async createNode(username, nodeData) {
    await this.delay();
    
    const nodeId = 'node' + Date.now() + Math.random().toString(36).substr(2, 5);
    const node = {
      id: nodeId,
      ...nodeData,
      owner: username,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this.nodes.set(nodeId, node);
    this.userNodes.get(username).add(nodeId);

    // Add to parent if specified
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent && parent.type === 'directory') {
        if (!Array.isArray(parent.contents)) {
          parent.contents = [];
        }
        parent.contents.push(nodeId);
      }
    }

    return { success: true, node };
  }

  async updateNode(username, nodeId, updateData) {
    await this.delay();
    
    const node = this.nodes.get(nodeId);
    if (!node || node.owner !== username) {
      throw new Error('Node not found');
    }

    Object.assign(node, updateData, {
      modifiedAt: new Date().toISOString()
    });

    this.nodes.set(nodeId, node);
    return { success: true };
  }

  async deleteNodes(username, nodeId) {
    await this.delay();
    
    const node = this.nodes.get(nodeId);
    if (!node || node.owner !== username) {
      throw new Error('Node not found');
    }

    // Remove from parent
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent && Array.isArray(parent.contents)) {
        parent.contents = parent.contents.filter(id => id !== nodeId);
      }
    }

    // Remove recursively if directory
    if (node.type === 'directory' && Array.isArray(node.contents)) {
      for (const childId of node.contents) {
        await this.deleteNodes(username, childId);
      }
    }

    this.nodes.delete(nodeId);
    this.userNodes.get(username).delete(nodeId);

    return { success: true };
  }

  // Cache invalidation methods (for compatibility)
  invalidateUserCache(username) {
    // No-op in mock
  }
}

module.exports = new MockAPIClient();
