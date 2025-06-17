const cache = require('memory-cache');

class CacheManager {
  constructor() {
    this.defaultTTL = 300000; // 5 minutes default
  }

  set(key, value, ttl = this.defaultTTL) {
    return cache.put(key, value, ttl);
  }

  get(key) {
    return cache.get(key);
  }

  del(key) {
    return cache.del(key);
  }

  clear() {
    return cache.clear();
  }

  // Cache middleware for express routes
  middleware(duration = this.defaultTTL) {
    return (req, res, next) => {
      const key = req.originalUrl || req.url;
      const cached = this.get(key);

      if (cached) {
        return res.json(cached);
      }

      res.sendResponse = res.json;
      res.json = (body) => {
        this.set(key, body, duration);
        res.sendResponse(body);
      };

      next();
    };
  }

  // Generate cache key for user-specific data
  userKey(username, resource, params = '') {
    return `user:${username}:${resource}:${params}`;
  }

  // Generate cache key for file/node data
  nodeKey(username, nodeId) {
    return `node:${username}:${nodeId}`;
  }

  // Generate cache key for search results
  searchKey(username, query) {
    const queryString = JSON.stringify(query);
    return `search:${username}:${Buffer.from(queryString).toString('base64')}`;
  }

  // Invalidate user-related cache
  invalidateUserCache(username) {
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith(`user:${username}:`) || key.startsWith(`node:${username}:`)) {
        this.del(key);
      }
    });
  }
}

module.exports = new CacheManager();
