const axios = require('axios');

class APIClient {
  constructor() {
    this.baseURL = process.env.API_BASE_URL;
    this.apiKey = process.env.API_KEY;
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.data.error || error.response.statusText}`);
      }
      throw new Error(`Network Error: ${error.message}`);
    }
  }

  // User endpoints
  async createUser(userData) {
    return this.makeRequest('POST', '/users', userData);
  }

  async getUser(username) {
    return this.makeRequest('GET', `/users/${username}`);
  }

  async updateUser(username, userData) {
    return this.makeRequest('PUT', `/users/${username}`, userData);
  }

  async deleteUser(username) {
    return this.makeRequest('DELETE', `/users/${username}`);
  }

  async authenticateUser(username, key) {
    return this.makeRequest('POST', `/users/${username}/auth`, { key });
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

    return this.makeRequest('GET', endpoint);
  }

  async createNode(username, nodeData) {
    return this.makeRequest('POST', `/filesystem/${username}`, nodeData);
  }

  async getNodes(username, nodeIds) {
    const nodeIdsString = Array.isArray(nodeIds) ? nodeIds.join('/') : nodeIds;
    return this.makeRequest('GET', `/filesystem/${username}/${nodeIdsString}`);
  }

  async updateNode(username, nodeId, nodeData) {
    return this.makeRequest('PUT', `/filesystem/${username}/${nodeId}`, nodeData);
  }

  async deleteNodes(username, nodeIds) {
    const nodeIdsString = Array.isArray(nodeIds) ? nodeIds.join('/') : nodeIds;
    return this.makeRequest('DELETE', `/filesystem/${username}/${nodeIdsString}`);
  }
}

module.exports = new APIClient();
