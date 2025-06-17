const axios = require('axios');
const cache = require('./cache');

class APIClient {
  constructor() {
    // Use environment variables with fallbacks for development
    this.baseURL = process.env.API_BASE_URL || 'https://drive.api.hscc.bdpa.org/v1';
    this.apiKey = process.env.API_KEY || 'dev-api-key-placeholder';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  async makeRequest(method, endpoint, data = null, options = {}) {
    const { useCache = false, cacheKey = null, cacheTTL = 300000 } = options;
    
    // Check cache first if enabled
    if (useCache && cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const config = {
          method,
          url: `${this.baseURL}${endpoint}`,
          headers: {
            'Authorization': `bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        };

        if (data) {
          config.data = data;
        }

        const response = await axios(config);
        
        // Cache successful responses
        if (useCache && cacheKey && response.data) {
          cache.set(cacheKey, response.data, cacheTTL);
        }
        
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Handle HTTP 555 errors with retry
        if (error.response && error.response.status === 555) {
          console.log(`API returned 555 error, attempt ${attempt}/${this.maxRetries}`);
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelay * attempt);
            continue;
          }
        }
        
        // Don't retry for other client errors (4xx)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          break;
        }
        
        // Retry for server errors (5xx) and network errors
        if (attempt < this.maxRetries) {
          console.log(`API request failed, attempt ${attempt}/${this.maxRetries}:`, error.message);
          await this.delay(this.retryDelay * attempt);
          continue;
        }
      }
    }
    
    // Handle the final error
    if (lastError.response) {
      const status = lastError.response.status;
      const message = lastError.response.data?.error || lastError.response.statusText;
      
      if (status === 555) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      } else if (status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      } else if (status >= 500) {
        throw new Error('Server error occurred. Please try again later.');
      } else {
        throw new Error(`API Error: ${message}`);
      }
    }
    
    throw new Error(`Network Error: ${lastError.message}`);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // User endpoints
  async createUser(userData) {
    const result = await this.makeRequest('POST', '/users', userData);
    // Invalidate any existing user cache
    cache.invalidateUserCache(userData.username);
    return result;
  }

  async getUser(username) {
    const cacheKey = cache.userKey(username, 'profile');
    return this.makeRequest('GET', `/users/${username}`, null, {
      useCache: true,
      cacheKey,
      cacheTTL: 600000 // 10 minutes
    });
  }

  async updateUser(username, userData) {
    const result = await this.makeRequest('PUT', `/users/${username}`, userData);
    // Invalidate user cache
    cache.invalidateUserCache(username);
    return result;
  }

  async deleteUser(username) {
    const result = await this.makeRequest('DELETE', `/users/${username}`);
    // Invalidate user cache
    cache.invalidateUserCache(username);
    return result;
  }

  async authenticateUser(username, key) {
    return this.makeRequest('POST', `/users/${username}/auth`, { key });
  }

  // Password recovery endpoints
  async requestPasswordReset(email) {
    return this.makeRequest('POST', `/auth/reset-request`, { email });
  }

  async resetPassword(token, newPassword) {
    return this.makeRequest('POST', `/auth/reset-password`, { token, newPassword });
  }

  // Filesystem endpoints
  async searchNodes(username, query = {}) {
    let endpoint = `/filesystem/${username}/search`;
    const params = [];

    if (query.after) {
      params.push(`after=${query.after}`);
    }

    if (query.match) {
      params.push(`match=${encodeURIComponent(JSON.stringify(query.match))}`);
    }

    if (query.regexMatch) {
      params.push(`regexMatch=${encodeURIComponent(JSON.stringify(query.regexMatch))}`);
    }

    if (params.length > 0) {
      endpoint += '?' + params.join('&');
    }

    const cacheKey = cache.searchKey(username, query);
    return this.makeRequest('GET', endpoint, null, {
      useCache: true,
      cacheKey,
      cacheTTL: 180000 // 3 minutes for search results
    });
  }

  async createNode(username, nodeData) {
    const result = await this.makeRequest('POST', `/filesystem/${username}`, nodeData);
    // Invalidate search cache and parent node cache
    cache.invalidateUserCache(username);
    return result;
  }

  async getNodes(username, nodeIds) {
    const nodeIdsString = Array.isArray(nodeIds) ? nodeIds.join('/') : nodeIds;
    const cacheKey = cache.nodeKey(username, nodeIdsString);
    
    return this.makeRequest('GET', `/filesystem/${username}/${nodeIdsString}`, null, {
      useCache: true,
      cacheKey,
      cacheTTL: 300000 // 5 minutes
    });
  }

  async updateNode(username, nodeId, nodeData) {
    const result = await this.makeRequest('PUT', `/filesystem/${username}/${nodeId}`, nodeData);
    // Invalidate node cache and search cache
    cache.del(cache.nodeKey(username, nodeId));
    cache.invalidateUserCache(username);
    return result;
  }

  async deleteNodes(username, nodeIds) {
    const nodeIdsString = Array.isArray(nodeIds) ? nodeIds.join('/') : nodeIds;
    const result = await this.makeRequest('DELETE', `/filesystem/${username}/${nodeIdsString}`);
    // Invalidate related caches
    if (Array.isArray(nodeIds)) {
      nodeIds.forEach(id => cache.del(cache.nodeKey(username, id)));
    } else {
      cache.del(cache.nodeKey(username, nodeIds));
    }
    cache.invalidateUserCache(username);
    return result;
  }
}

module.exports = new APIClient();
