// BDPADrive JavaScript Application

document.addEventListener('DOMContentLoaded', function() {
    initializeFilePreview();
    initializeFormValidation();
    initializeTooltips();
});

// Initialize file preview generation
function initializeFilePreview() {
    const fileCards = document.querySelectorAll('.file-preview');
    
    fileCards.forEach(preview => {
        const encodedText = preview.getAttribute('data-text');
        if (encodedText) {
            try {
                const text = decodeURIComponent(encodedText);
                generateFilePreview(text, preview);
            } catch (error) {
                console.error('Error decoding file text:', error);
                showPreviewError(preview);
            }
        }
    });
}

// Generate file preview from markdown text
function generateFilePreview(markdownText, previewElement) {
    try {
        // Check if markdown-it is available
        if (typeof markdownit === 'undefined') {
            showPreviewError(previewElement, 'Markdown parser not available');
            return;
        }
        
        const md = markdownit();
        const html = md.render(markdownText || '# Empty File\n\nThis file has no content.');
        
        // Create a temporary div to render the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        tempDiv.className = 'markdown-preview';
        tempDiv.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: 300px;
            height: 120px;
            padding: 8px;
            font-size: 12px;
            line-height: 1.2;
            background: white;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        document.body.appendChild(tempDiv);
        
        // Check if html2canvas is available
        if (typeof html2canvas === 'undefined') {
            // Fallback: show text preview
            previewElement.innerHTML = `<div class="markdown-preview">${html}</div>`;
            document.body.removeChild(tempDiv);
            return;
        }
        
        // Generate canvas from HTML
        html2canvas(tempDiv, {
            width: 300,
            height: 120,
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            // Convert canvas to image
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.alt = 'File preview';
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; object-position: top left;';
            
            // Replace loading content with image
            previewElement.innerHTML = '';
            previewElement.appendChild(img);
            
            // Clean up
            document.body.removeChild(tempDiv);
        }).catch(error => {
            console.error('Error generating preview:', error);
            // Fallback: show text preview
            previewElement.innerHTML = `<div class="markdown-preview">${html}</div>`;
            document.body.removeChild(tempDiv);
        });
        
    } catch (error) {
        console.error('Error generating file preview:', error);
        showPreviewError(previewElement);
    }
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
}

// Initialize form validation
function initializeFormValidation() {
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
    
    // Tag validation
    const tagInputs = document.querySelectorAll('input[name="tags"]');
    tagInputs.forEach(input => {
        input.addEventListener('input', function() {
            const tags = this.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            
            if (tags.length > 5) {
                this.setCustomValidity('Maximum of 5 tags allowed');
            } else {
                // Check if all tags are alphanumeric
                const invalidTags = tags.filter(tag => !/^[a-zA-Z0-9]+$/.test(tag));
                if (invalidTags.length > 0) {
                    this.setCustomValidity('Tags must be alphanumeric words');
                } else {
                    this.setCustomValidity('');
                }
            }
        });
    });
    
    // File size validation
    const textAreas = document.querySelectorAll('textarea[name="text"]');
    textAreas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            const byteSize = new Blob([this.value]).size;
            const maxSize = 10 * 1024; // 10KB
            
            if (byteSize > maxSize) {
                this.setCustomValidity(`File content exceeds maximum size of 10KB`);
            } else {
                this.setCustomValidity('');
            }
        });
    });
}

// Initialize Bootstrap tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    if (typeof bootstrap !== 'undefined') {
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

// Utility functions
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container') || createAlertContainer();
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertContainer.appendChild(alert);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    document.body.appendChild(container);
    return container;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Copy text to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = 'position: fixed; top: -9999px; left: -9999px;';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showAlert('Copied to clipboard!', 'success');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showAlert('Failed to copy to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Debounce function for performance
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction() {
        const context = this;
        const args = arguments;
        
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(context, args);
    };
}

// Loading state management
function setLoadingState(element, loading = true) {
    if (loading) {
        element.classList.add('loading');
        element.disabled = true;
        
        // Add spinner if it's a button
        if (element.tagName === 'BUTTON') {
            const originalText = element.innerHTML;
            element.setAttribute('data-original-text', originalText);
            element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
    } else {
        element.classList.remove('loading');
        element.disabled = false;
        
        // Restore original button text
        if (element.tagName === 'BUTTON' && element.hasAttribute('data-original-text')) {
            element.innerHTML = element.getAttribute('data-original-text');
            element.removeAttribute('data-original-text');
        }
    }
}

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showAlert('An unexpected error occurred. Please refresh the page and try again.', 'danger');
});

// Export functions for use in templates
window.BDPADrive = {
    showAlert,
    copyToClipboard,
    formatFileSize,
    setLoadingState,
    debounce
};
