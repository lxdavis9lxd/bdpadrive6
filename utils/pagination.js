class PaginationHelper {
  constructor() {
    this.defaultPageSize = 20;
    this.maxPageSize = 100;
  }

  /**
   * Parse pagination parameters from request
   * @param {Object} query - Express request query object
   * @returns {Object} Pagination parameters
   */
  parseParams(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(
      this.maxPageSize, 
      Math.max(1, parseInt(query.limit) || this.defaultPageSize)
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Create pagination metadata
   * @param {number} totalItems - Total number of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @param {string} baseUrl - Base URL for pagination links
   * @returns {Object} Pagination metadata
   */
  createMetadata(totalItems, page, limit, baseUrl = '') {
    const totalPages = Math.ceil(totalItems / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const urlParams = new URLSearchParams();
    
    return {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : null,
      prevPage: hasPrev ? page - 1 : null,
      startItem: totalItems > 0 ? (page - 1) * limit + 1 : 0,
      endItem: Math.min(page * limit, totalItems),
      links: {
        first: hasNext || hasPrev ? `${baseUrl}?${this.buildUrl(urlParams, 1, limit)}` : null,
        prev: hasPrev ? `${baseUrl}?${this.buildUrl(urlParams, page - 1, limit)}` : null,
        next: hasNext ? `${baseUrl}?${this.buildUrl(urlParams, page + 1, limit)}` : null,
        last: hasNext || hasPrev ? `${baseUrl}?${this.buildUrl(urlParams, totalPages, limit)}` : null
      }
    };
  }

  /**
   * Paginate an array of items
   * @param {Array} items - Array of items to paginate
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @returns {Object} Paginated result with items and metadata
   */
  paginate(items, page, limit, baseUrl = '') {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = items.slice(startIndex, endIndex);
    
    return {
      items: paginatedItems,
      pagination: this.createMetadata(items.length, page, limit, baseUrl)
    };
  }

  /**
   * Build URL with pagination parameters
   * @param {URLSearchParams} urlParams - Base URL parameters
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {string} URL parameters string
   */
  buildUrl(urlParams, page, limit) {
    const params = new URLSearchParams(urlParams);
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    return params.toString();
  }

  /**
   * Generate page numbers for pagination UI
   * @param {number} currentPage - Current page
   * @param {number} totalPages - Total pages
   * @param {number} maxVisible - Maximum visible page numbers
   * @returns {Array} Array of page numbers to display
   */
  getVisiblePages(currentPage, totalPages, maxVisible = 7) {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfVisible = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - halfVisible);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
}

module.exports = new PaginationHelper();
