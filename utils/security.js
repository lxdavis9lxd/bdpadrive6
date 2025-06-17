const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { body, validationResult } = require('express-validator');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

class SecurityUtils {
  /**
   * Sanitize HTML content to prevent XSS
   * @param {string} dirty - Potentially unsafe HTML
   * @returns {string} Sanitized HTML
   */
  sanitizeHtml(dirty) {
    if (!dirty || typeof dirty !== 'string') {
      return '';
    }
    
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'strong', 'em', 'u', 'strike',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false
    });
  }

  /**
   * Sanitize text content (strip all HTML)
   * @param {string} dirty - Potentially unsafe text
   * @returns {string} Plain text
   */
  sanitizeText(dirty) {
    if (!dirty || typeof dirty !== 'string') {
      return '';
    }
    
    return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
  }

  /**
   * Validate and sanitize user input
   * @param {string} input - User input
   * @param {Object} options - Validation options
   * @returns {string} Sanitized input
   */
  validateInput(input, options = {}) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    // Length validation
    if (options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Remove dangerous characters for filename/path validation
    if (options.isPath) {
      sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
    }

    // Sanitize HTML if allowed
    if (options.allowHtml) {
      sanitized = this.sanitizeHtml(sanitized);
    } else {
      sanitized = this.sanitizeText(sanitized);
    }

    return sanitized;
  }

  /**
   * Express validator middleware for common validations
   */
  getValidationRules() {
    return {
      username: [
        body('username')
          .isLength({ min: 3, max: 30 })
          .withMessage('Username must be between 3 and 30 characters')
          .matches(/^[a-zA-Z0-9_-]+$/)
          .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
          .customSanitizer(value => this.sanitizeText(value))
      ],
      
      email: [
        body('email')
          .isEmail()
          .withMessage('Please provide a valid email address')
          .normalizeEmail()
          .customSanitizer(value => this.sanitizeText(value))
      ],
      
      password: [
        body('password')
          .isLength({ min: 8, max: 128 })
          .withMessage('Password must be between 8 and 128 characters')
          .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
          .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character')
      ],
      
      filename: [
        body('name')
          .isLength({ min: 1, max: 255 })
          .withMessage('Filename must be between 1 and 255 characters')
          .matches(/^[^<>:"|?*\x00-\x1f]*$/)
          .withMessage('Filename contains invalid characters')
          .customSanitizer(value => this.validateInput(value, { isPath: true }))
      ],

      text: [
        body('content')
          .isLength({ max: 1000000 }) // 1MB limit
          .withMessage('Content too large')
          .customSanitizer(value => this.sanitizeHtml(value))
      ]
    };
  }

  /**
   * Middleware to handle validation errors
   */
  handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed');
      error.status = 400;
      error.details = errors.array();
      return next(error);
    }
    next();
  }

  /**
   * Generate secure random string
   * @param {number} length - Length of string
   * @returns {string} Random string
   */
  generateSecureToken(length = 32) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Rate limiting key generator based on IP and user
   * @param {Object} req - Express request object
   * @returns {string} Rate limiting key
   */
  getRateLimitKey(req) {
    const ip = req.ip || req.connection.remoteAddress;
    const user = req.session?.user?.username || 'anonymous';
    return `${ip}:${user}`;
  }
}

module.exports = new SecurityUtils();
