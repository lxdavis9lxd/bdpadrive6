// BDPADrive JavaScript Application

// Global app configuration
const AppConfig = {
    API_TIMEOUT: 30000,
    DEBOUNCE_DELAY: 300,
    RETRY_ATTEMPTS: 3,
    PREVIEW_CACHE: new Map()
};

// Performance monitoring
const Performance = {
    startTime: Date.now(),
    
    mark(name) {
        if (window.performance && window.performance.mark) {
            window.performance.mark(name);
        }
    },
    
    measure(name, startMark, endMark) {
        if (window.performance && window.performance.measure) {
            try {
                window.performance.measure(name, startMark, endMark);
                const measure = window.performance.getEntriesByName(name)[0];
                console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
            } catch (e) {
                // Ignore measurement errors
            }
        }
    }
};

// Error handling utilities
const ErrorHandler = {
    show(message, type = 'error') {
        const alertClass = type === 'error' ? 'alert-danger' : 
                          type === 'warning' ? 'alert-warning' : 'alert-info';
        
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.querySelector('.container, .container-fluid') || document.body;
        container.insertBefore(alert, container.firstChild);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    },
    
    handleApiError(error) {
        let message = 'An unexpected error occurred. Please try again.';
        
        if (error.message.includes('Network Error')) {
            message = 'Network connection error. Please check your internet connection.';
        } else if (error.message.includes('timeout')) {
            message = 'Request timed out. Please try again.';
        } else if (error.message.includes('555')) {
            message = 'Service temporarily unavailable. Retrying...';
        }
        
        this.show(message, 'error');
    }
};

// Loading state management
const LoadingManager = {
    show(element, text = 'Loading...') {
        if (!element) return;
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner text-center p-3';
        spinner.innerHTML = `
            <div class="spinner-border spinner-border-sm text-primary me-2"></div>
            <span class="text-muted">${text}</span>
        `;
        
        element.innerHTML = '';
        element.appendChild(spinner);
    },
    
    hide(element) {
        if (!element) return;
        
        const spinner = element.querySelector('.loading-spinner');
        if (spinner) {
            spinner.remove();
        }
    },
    
    showGlobal(text = 'Loading...') {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.querySelector('span').textContent = text;
            indicator.classList.remove('d-none');
        }
    },
    
    hideGlobal() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.classList.add('d-none');
        }
    }
};

// Debounce utility for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    Performance.mark('app-init-start');
    
    // Ensure loading indicator is hidden on page load
    LoadingManager.hideGlobal();
    
    try {
        // Only initialize features that are relevant for the current page
        const isAuthPage = window.location.pathname.includes('/auth/');
        const isExplorerPage = window.location.pathname.includes('/explorer');
        
        if (!isAuthPage) {
            initializeFilePreview();
            initializeLazyLoading();
            initializeInfiniteScroll();
        }
        
        // Always initialize these
        initializeFormValidation();
        initializeTooltips();
        initializeErrorRecovery();
        
        Performance.mark('app-init-end');
        Performance.measure('app-initialization', 'app-init-start', 'app-init-end');
    } catch (error) {
        console.error('Error initializing app:', error);
        // Don't show error on auth pages to avoid confusion
        if (!window.location.pathname.includes('/auth/')) {
            ErrorHandler.show('Application failed to initialize properly. Please refresh the page.');
        }
    }
});

// Ensure no loading states are shown inappropriately on auth pages
if (window.location.pathname.includes('/auth/')) {
    // Hide any loading indicators immediately on auth pages
    document.addEventListener('DOMContentLoaded', function() {
        LoadingManager.hideGlobal();
        
        // Remove any loading classes that might be left over
        const body = document.body;
        body.classList.remove('loading');
        
        // Ensure form buttons are in proper state
        const submitButtons = document.querySelectorAll('button[type="submit"]');
        submitButtons.forEach(btn => {
            if (btn.disabled && btn.getAttribute('data-original-text')) {
                btn.disabled = false;
                btn.innerHTML = btn.getAttribute('data-original-text');
            }
        });
    });
}

// Initialize file preview generation with caching
function initializeFilePreview() {
    const fileCards = document.querySelectorAll('.file-preview[data-text]');
    
    // Exit early if no file preview elements exist
    if (fileCards.length === 0) {
        return;
    }
    
    // Use Intersection Observer for lazy loading
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const preview = entry.target;
                const encodedText = preview.getAttribute('data-text');
                
                if (encodedText && !preview.classList.contains('preview-loaded')) {
                    generateFilePreview(encodedText, preview);
                    observer.unobserve(preview);
                }
            }
        });
    }, { threshold: 0.1 });
    
    fileCards.forEach(preview => observer.observe(preview));
}

// Generate file preview with caching and error handling
function generateFilePreview(encodedText, previewElement) {
    try {
        // Check cache first
        if (AppConfig.PREVIEW_CACHE.has(encodedText)) {
            const cached = AppConfig.PREVIEW_CACHE.get(encodedText);
            previewElement.innerHTML = cached;
            previewElement.classList.add('preview-loaded');
            return;
        }
        
        LoadingManager.show(previewElement, 'Generating preview...');
        
        const text = decodeURIComponent(encodedText);
        
        // Use requestIdleCallback for performance
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                generatePreviewContent(text, previewElement, encodedText);
            });
        } else {
            setTimeout(() => {
                generatePreviewContent(text, previewElement, encodedText);
            }, 0);
        }
        
    } catch (error) {
        console.error('Error decoding file text:', error);
        showPreviewError(previewElement, 'Failed to decode file content');
    }
}

function generatePreviewContent(markdownText, previewElement, cacheKey) {
    try {
        if (typeof markdownit === 'undefined') {
            showPreviewError(previewElement, 'Markdown parser not available');
            return;
        }
        
        const md = markdownit({
            html: false, // Disable HTML for security
            xhtmlOut: true,
            breaks: true,
            linkify: true
        });
        
        const html = md.render(markdownText || '# Empty File\n\nThis file has no content.');
        
        // Create preview with proper sanitization
        const sanitizedHtml = sanitizePreviewHtml(html);
        const previewHtml = `<div class="markdown-preview">${sanitizedHtml}</div>`;
        
        // Cache the result
        AppConfig.PREVIEW_CACHE.set(cacheKey, previewHtml);
        
        // Apply to element
        previewElement.innerHTML = previewHtml;
        previewElement.classList.add('preview-loaded');
        
        // Cleanup cache if it gets too large
        if (AppConfig.PREVIEW_CACHE.size > 100) {
            const firstKey = AppConfig.PREVIEW_CACHE.keys().next().value;
            AppConfig.PREVIEW_CACHE.delete(firstKey);
        }
        
    } catch (error) {
        console.error('Error generating preview content:', error);
        showPreviewError(previewElement, 'Failed to generate preview');
    }
}

// Sanitize HTML for security
function sanitizePreviewHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Remove script tags and event handlers
    const scripts = div.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    const allElements = div.querySelectorAll('*');
    allElements.forEach(element => {
        // Remove event handler attributes
        for (let i = element.attributes.length - 1; i >= 0; i--) {
            const attr = element.attributes[i];
            if (attr.name.startsWith('on')) {
                element.removeAttribute(attr.name);
            }
        }
        
        // Remove dangerous attributes
        ['javascript:', 'data:', 'vbscript:'].forEach(protocol => {
            if (element.getAttribute('href')?.includes(protocol) ||
                element.getAttribute('src')?.includes(protocol)) {
                element.removeAttribute('href');
                element.removeAttribute('src');
            }
        });
    });
    
    return div.innerHTML;
}

// Show preview error
function showPreviewError(previewElement, message = 'Preview unavailable') {
    previewElement.innerHTML = `
        <div class="preview-loading">
            <span class="text-muted">
                <i class="fas fa-exclamation-triangle"></i> ${message}
            </span>
        </div>
    `;
    previewElement.classList.add('preview-loaded');
}

// Initialize form validation with security
function initializeFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        // Skip loading states for auth pages
        const isAuthPage = window.location.pathname.includes('/auth/');
        
        // Prevent multiple submissions
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                // Store original text before changing
                if (!submitBtn.hasAttribute('data-original-text')) {
                    submitBtn.setAttribute('data-original-text', submitBtn.innerHTML);
                }
                
                // Only show loading for non-auth forms
                if (!isAuthPage && !form.hasAttribute('data-no-loading')) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Processing...`;
                    
                    // Re-enable after 10 seconds as fallback
                    setTimeout(() => {
                        if (submitBtn.disabled) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = submitBtn.getAttribute('data-original-text') || 'Submit';
                        }
                    }, 10000);
                }
            }
        });
        
        // Reset form state on page back/forward
        window.addEventListener('pageshow', function(event) {
            if (event.persisted) {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn && submitBtn.disabled) {
                    submitBtn.disabled = false;
                    const originalText = submitBtn.getAttribute('data-original-text');
                    if (originalText) {
                        submitBtn.innerHTML = originalText;
                    }
                }
            }
        });
    });
    
    // Password confirmation validation
    const confirmPasswordInputs = document.querySelectorAll('input[name="confirmPassword"]');
    confirmPasswordInputs.forEach(input => {
        const form = input.closest('form');
        const passwordInput = form.querySelector('input[name="password"], input[name="newPassword"]');
        
        if (passwordInput) {
            function validatePasswordMatch() {
                if (input.value !== passwordInput.value) {
                    input.setCustomValidity('Passwords do not match');
                } else {
                    input.setCustomValidity('');
                }
            }
            
            input.addEventListener('input', validatePasswordMatch);
            passwordInput.addEventListener('input', validatePasswordMatch);
        }
    });
    
    // Real-time input validation
    const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
    textInputs.forEach(input => {
        input.addEventListener('input', debounce(function() {
            validateInput(this);
        }, AppConfig.DEBOUNCE_DELAY));
    });
}

// Validate individual input
function validateInput(input) {
    const value = input.value.trim();
    
    // File name validation
    if (input.name === 'name' || input.name === 'filename') {
        const invalidChars = /[<>:"|?*\x00-\x1f]/;
        if (invalidChars.test(value)) {
            input.setCustomValidity('Filename contains invalid characters');
            return;
        }
    }
    
    // Clear custom validity if all checks pass
    input.setCustomValidity('');
}

// Initialize tooltips
function initializeTooltips() {
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

// Initialize lazy loading for images
function initializeLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    // Exit early if no lazy images exist
    if (lazyImages.length === 0) {
        return;
    }
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });
        
        lazyImages.forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// Initialize infinite scroll for pagination
function initializeInfiniteScroll() {
    const paginationContainer = document.querySelector('.pagination-container');
    if (!paginationContainer) return;
    
    const nextPageBtn = document.querySelector('.pagination .page-item:last-child .page-link[href]');
    if (!nextPageBtn) return;
    
    let loading = false;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !loading) {
                loading = true;
                loadNextPage(nextPageBtn.href);
            }
        });
    }, { threshold: 0.1 });
    
    // Create a sentinel element
    const sentinel = document.createElement('div');
    sentinel.className = 'pagination-sentinel';
    sentinel.style.height = '1px';
    paginationContainer.appendChild(sentinel);
    observer.observe(sentinel);
}

// Load next page via AJAX
function loadNextPage(url) {
    LoadingManager.showGlobal('Loading more items...');
    
    fetch(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
    })
    .then(html => {
        // Parse the response and append new items
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newItems = doc.querySelectorAll('.file-card, .list-item');
        
        const container = document.querySelector('.row, .list-group');
        if (container && newItems.length > 0) {
            newItems.forEach(item => {
                container.appendChild(item);
            });
            
            // Re-initialize file previews for new items
            initializeFilePreview();
        }
        
        LoadingManager.hideGlobal();
    })
    .catch(error => {
        console.error('Error loading next page:', error);
        ErrorHandler.handleApiError(error);
        LoadingManager.hideGlobal();
    });
}

// Initialize error recovery mechanisms
function initializeErrorRecovery() {
    // Global error handler
    window.addEventListener('error', function(event) {
        console.error('Global error:', event.error);
        ErrorHandler.show('An unexpected error occurred. The page will attempt to recover.');
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        ErrorHandler.show('A background operation failed. Please try refreshing the page.');
        event.preventDefault();
    });
    
    // Network status monitoring
    if ('onLine' in navigator) {
        window.addEventListener('online', function() {
            ErrorHandler.show('Connection restored.', 'info');
        });
        
        window.addEventListener('offline', function() {
            ErrorHandler.show('Connection lost. Some features may not work.', 'warning');
        });
    }
    
    // Add retry buttons to failed operations
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-retry')) {
            e.preventDefault();
            const action = e.target.getAttribute('data-action');
            if (action === 'reload') {
                location.reload();
            } else if (action === 'retry-preview') {
                const preview = e.target.closest('.file-preview');
                if (preview) {
                    const encodedText = preview.getAttribute('data-text');
                    if (encodedText) {
                        generateFilePreview(encodedText, preview);
                    }
                }
            }
        }
    });
}

// Utility function for API calls with retry logic
async function apiCall(url, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= AppConfig.RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                timeout: AppConfig.API_TIMEOUT
            });
            
            if (response.status === 555) {
                throw new Error('Service temporarily unavailable (555)');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            lastError = error;
            
            if (attempt < AppConfig.RETRY_ATTEMPTS && 
                (error.message.includes('555') || error.message.includes('timeout'))) {
                console.log(`API call failed, attempt ${attempt}/${AppConfig.RETRY_ATTEMPTS}:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            
            break;
        }
    }
    
    throw lastError;
}

// Performance optimization: preload next page
function preloadNextPage() {
    const nextPageLink = document.querySelector('.pagination .page-item:last-child .page-link[href]');
    if (nextPageLink) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = nextPageLink.href;
        document.head.appendChild(link);
    }
}

// Initialize performance optimizations
document.addEventListener('DOMContentLoaded', function() {
    // Preload next page after a delay
    setTimeout(preloadNextPage, 2000);
    
    // Report performance metrics
    window.addEventListener('load', function() {
        if (window.performance) {
            const navigation = performance.getEntriesByType('navigation')[0];
            const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
            
            console.log('Performance metrics:', {
                pageLoadTime: loadTime + 'ms',
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart + 'ms',
                totalLoadTime: navigation.loadEventEnd - navigation.fetchStart + 'ms'
            });
        }
    });
});
