// Debug function - helps find correct Gmail selectors
function debugGmailElements() {
    console.log('=== UAS DEBUG: Gmail Elements Analysis ===');
    
    // Analyze all input and textarea elements
    const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    console.log('UAS DEBUG: Found', allInputs.length, 'input/editable elements');
    
    allInputs.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { // Only visible elements
            console.log(`UAS DEBUG: Element ${index}:`, {
                tagName: el.tagName,
                type: el.type || 'N/A',
                name: el.name || 'N/A',
                id: el.id || 'N/A',
                ariaLabel: el.getAttribute('aria-label') || 'N/A',
                placeholder: el.getAttribute('placeholder') || 'N/A',
                role: el.getAttribute('role') || 'N/A',
                className: el.className || 'N/A',
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                contenteditable: el.contentEditable || 'N/A',
                value: el.tagName === 'DIV' ? (el.textContent?.substring(0, 50) + '...') : (el.value?.substring(0, 50) + '...') || 'empty'
            });
        }
    });
    
    console.log('=== End Debug ===');
}

function insertToGmail() {
    const span = window.UAS_TRACE ? UAS_TRACE.startSpan('gmail_insert', {}) : null;
    chrome.storage.local.get(['articleContentForGmail', 'articleToEmail', 'articleSubject'], data => {
        if (!data.articleContentForGmail) {
            console.log('UAS: No article content found in storage');
            window.UAS_TRACE && UAS_TRACE.event('gmail_no_content', {});
            return;
        }

        console.log('UAS: Attempting to insert article content into Gmail');
        
        // Call debug function to analyze elements
        debugGmailElements();

        // Body - try multiple selectors
        const bodySelectors = [
            'div[aria-label="Message Body"]',
            'div[contenteditable="true"][aria-label="Message Body"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[g_editable="true"]',
            '.editable[contenteditable="true"]',
            // Additional selectors for message body
            'div[aria-label*="Message" i][contenteditable="true"]',
            'div[role="textbox"][contenteditable="true"]',
            'div.Am.Al.editable',
            'div[dir="ltr"][contenteditable="true"]',
            '[contenteditable="true"]:not([aria-label*="To"]):not([aria-label*="Subject"])'
        ];
        
        let bodyDiv = null;
        for (const selector of bodySelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                // Check that this is actually the message body, not To or Subject field
                const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
                const className = element.className.toLowerCase();
                
                // Exclude elements that are clearly not the message body
                if (ariaLabel.includes('to') || ariaLabel.includes('subject') || 
                    ariaLabel.includes('recipient') || className.includes('subject')) {
                    continue;
                }
                
                // Check element size - message body is usually larger
                const rect = element.getBoundingClientRect();
                if (rect.height > 50 && rect.width > 200) {
                    bodyDiv = element;
                    console.log('UAS: Found body element with selector:', selector, 'size:', rect.width + 'x' + rect.height);
                    window.UAS_TRACE && UAS_TRACE.event('gmail_body_found', { selector, w: Math.round(rect.width), h: Math.round(rect.height) });
                    break;
                }
            }
            if (bodyDiv) break;
        }
        
        if (bodyDiv) {
            // Focus on element and wait a bit
            bodyDiv.focus();
            setTimeout(() => {
                // Clear content
                bodyDiv.innerHTML = '';
                
                // Insert content
                bodyDiv.innerHTML = data.articleContentForGmail;
                window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'content_inserted', { length: data.articleContentForGmail.length });

                // Ensure images are sized to best fit the compose area
                try {
                    const applyBestFit = (img) => {
                        // Remove hard-coded dimensions that could break responsiveness
                        img.removeAttribute('width');
                        img.removeAttribute('height');
                        // Compute container width
                        const containerWidth = bodyDiv.clientWidth || 600; // fallback estimate
                        // If natural width bigger than container, scale down
                        if (img.naturalWidth > containerWidth) {
                            img.style.width = '100%';
                        } else {
                            // Preserve natural size but avoid overflow
                            img.style.width = Math.min(img.naturalWidth, containerWidth) + 'px';
                        }
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                        img.style.boxSizing = 'border-box';
                        img.style.display = 'block'; // avoids inline whitespace issues and centers width behavior
                        // Add a subtle border radius for aesthetics (optional) – keep minimal
                        img.style.borderRadius = '4px';
                    };

                    const processImages = () => {
                        const images = bodyDiv.querySelectorAll('img');
                        if (!images.length) {
                            console.log('UAS: No images found to best-fit');
                            window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'no_images_found', {});
                            return;
                        }
                        images.forEach(img => {
                            if (img.complete) {
                                applyBestFit(img);
                            } else {
                                img.addEventListener('load', () => applyBestFit(img), { once: true });
                            }
                        });
                        console.log('UAS: Applied best-fit sizing to', images.length, 'images');
                        window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'images_best_fit_applied', { count: images.length });
                    };

                    // Initial processing
                    processImages();

                    // Observe for late-added or replaced images
                    const imgObserver = new MutationObserver(() => {
                        processImages();
                    });
                    imgObserver.observe(bodyDiv, { childList: true, subtree: true });
                    // Stop observing after a reasonable time (e.g., 10s) to avoid performance impact
                    setTimeout(() => imgObserver.disconnect(), 10000);
                } catch (e) {
                    console.warn('UAS: Best-fit image sizing failed:', e);
                }
                
                // Trigger events to notify Gmail of changes
                bodyDiv.dispatchEvent(new Event('input', { bubbles: true }));
                bodyDiv.dispatchEvent(new Event('change', { bubbles: true }));
                bodyDiv.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                bodyDiv.dispatchEvent(new Event('paste', { bubbles: true }));
                
                console.log('UAS: Article content inserted into body');
                window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'gmail_body_insert_complete', {});
                
                // Additional check - make sure content was actually inserted
                setTimeout(() => {
                    if (bodyDiv.innerHTML.includes('Source:')) {
                        console.log('UAS: Content insertion verified successfully');
                        window.UAS_TRACE && UAS_TRACE.endSpan(span, { status: 'success' });
                    } else {
                        console.warn('UAS: Content insertion may have failed, retrying...');
                        bodyDiv.innerHTML = data.articleContentForGmail;
                        bodyDiv.dispatchEvent(new Event('input', { bubbles: true }));
                        window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'retry_body_insert', {});
                    }
                }, 200);
            }, 100);
        } else {
            console.warn('UAS: Body element not found');
            window.UAS_TRACE && UAS_TRACE.endSpan(span, { status: 'body_not_found' });
            // Log all contenteditable elements for debugging
            setTimeout(() => {
                const allEditables = document.querySelectorAll('[contenteditable="true"]');
                console.log('UAS: Found', allEditables.length, 'contenteditable elements');
                allEditables.forEach((el, index) => {
                    const rect = el.getBoundingClientRect();
                    console.log(`UAS: Editable ${index}:`, {
                        ariaLabel: el.getAttribute('aria-label'),
                        className: el.className,
                        size: rect.width + 'x' + rect.height,
                        role: el.getAttribute('role')
                    });
                });
            }, 1000);
        }

        // To - enhanced search for recipient field
        if (data.articleToEmail) {
            const toSelectors = [
                // Main selectors for "To" field
                'textarea[name="to"]',
                'input[name="to"]',
                'div[data-name="to"] textarea',
                'div[data-name="to"] input',
                // Additional selectors for modern Gmail
                'input[aria-label*="To" i]',
                'textarea[aria-label*="To" i]',
                'input[placeholder*="Recipients" i]',
                'textarea[placeholder*="Recipients" i]',
                'div[role="combobox"][aria-label*="To" i]',
                'div[role="textbox"][aria-label*="To" i]',
                // Selectors for compose view
                'div.aoD.hl input',
                'div.aoD.hl textarea',
                'div[jsname] input[email]',
                'div[jsname] textarea[email]',
                // Broad selectors
                'input[type="email"]',
                'textarea[type="email"]',
                'input[dir="ltr"]',
                'textarea[dir="ltr"]'
            ];
            
            let toField = null;
            for (const selector of toSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // Check that this is actually the "To" field
                    const parentText = element.closest('tr, div, td')?.textContent?.toLowerCase() || '';
                    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
                    const placeholder = element.getAttribute('placeholder')?.toLowerCase() || '';
                    
                    if (parentText.includes('to') || ariaLabel.includes('to') || 
                        ariaLabel.includes('recipient') || placeholder.includes('recipient') ||
                        element.closest('[data-name="to"]') || element.name === 'to') {
                        toField = element;
                        console.log('UAS: Found to field with selector:', selector);
                        window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'to_field_found', { selector });
                        break;
                    }
                }
                if (toField) break;
            }
            
            if (toField) {
                // Focus on field and wait a bit
                toField.focus();
                setTimeout(() => {
                    // Clear field before filling
                    toField.value = '';
                    toField.innerHTML = '';
                    
                    // Fill value
                    if (toField.tagName.toLowerCase() === 'div') {
                        toField.textContent = data.articleToEmail;
                    } else {
                        toField.value = data.articleToEmail;
                    }
                    
                    // Trigger events
                    toField.dispatchEvent(new Event('input', { bubbles: true }));
                    toField.dispatchEvent(new Event('change', { bubbles: true }));
                    toField.dispatchEvent(new Event('keyup', { bubbles: true }));
                    toField.dispatchEvent(new Event('blur', { bubbles: true }));
                    
                    console.log('UAS: To field filled with email:', data.articleToEmail);
                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'to_field_filled', {});
                }, 100);
            } else {
                console.warn('UAS: To field not found');
                window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'to_field_missing', {});
                // Try alternative method - via clipboard
                console.log('UAS: Trying alternative method for To field');
                setTimeout(() => {
                    const allInputs = document.querySelectorAll('input, textarea, div[contenteditable="true"]');
                    console.log('UAS: Found', allInputs.length, 'input elements');
                    allInputs.forEach((input, index) => {
                        console.log(`UAS: Input ${index}:`, {
                            tagName: input.tagName,
                            type: input.type,
                            name: input.name,
                            ariaLabel: input.getAttribute('aria-label'),
                            placeholder: input.getAttribute('placeholder'),
                            className: input.className
                        });
                    });
                }, 1000);
            }
        }

        // Subject - enhanced search for subject field
        if (data.articleSubject) {
            const subjectSelectors = [
                // Main selectors for Subject
                'input[name="subjectbox"]',
                'input[placeholder*="Subject" i]',
                'input[aria-label*="Subject" i]',
                // Additional selectors
                'input[name="subject"]',
                'textarea[name="subject"]',
                'input[id*="subject" i]',
                'textarea[id*="subject" i]',
                'div[role="textbox"][aria-label*="Subject" i]',
                // Selectors for modern Gmail
                'div.aoT input',
                'div.aoT textarea',
                'input[data-initial-value]',
                'input[dir="ltr"][class*="Ar"]'
            ];
            
            let subjField = null;
            for (const selector of subjectSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // Check that this is actually the Subject field
                    const parentText = element.closest('tr, div, td')?.textContent?.toLowerCase() || '';
                    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
                    const placeholder = element.getAttribute('placeholder')?.toLowerCase() || '';
                    const name = element.getAttribute('name')?.toLowerCase() || '';
                    
                    if (parentText.includes('subject') || ariaLabel.includes('subject') || 
                        placeholder.includes('subject') || name.includes('subject') ||
                        element.closest('[data-name="subject"]')) {
                        subjField = element;
                        console.log('UAS: Found subject field with selector:', selector);
                        window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'subject_field_found', { selector });
                        break;
                    }
                }
                if (subjField) break;
            }
            
            if (subjField) {
                // Focus on field and wait a bit
                subjField.focus();
                setTimeout(() => {
                    // Clear field before filling
                    subjField.value = '';
                    
                    // Fill value
                    if (subjField.tagName.toLowerCase() === 'div') {
                        subjField.textContent = data.articleSubject;
                    } else {
                        subjField.value = data.articleSubject;
                    }
                    
                    // Trigger events
                    subjField.dispatchEvent(new Event('input', { bubbles: true }));
                    subjField.dispatchEvent(new Event('change', { bubbles: true }));
                    subjField.dispatchEvent(new Event('keyup', { bubbles: true }));
                    subjField.dispatchEvent(new Event('blur', { bubbles: true }));
                    
                    console.log('UAS: Subject field filled with:', data.articleSubject);
                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'subject_field_filled', {});
                }, 100);
            } else {
                console.warn('UAS: Subject field not found');
                window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'subject_field_missing', {});
                // Try alternative method - log all possible fields
                setTimeout(() => {
                    const allInputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
                    console.log('UAS: Found', allInputs.length, 'text input elements for subject');
                    allInputs.forEach((input, index) => {
                        if (index < 10) { // Log only first 10
                            console.log(`UAS: Text Input ${index}:`, {
                                tagName: input.tagName,
                                type: input.type,
                                name: input.name,
                                ariaLabel: input.getAttribute('aria-label'),
                                placeholder: input.getAttribute('placeholder'),
                                className: input.className,
                                value: input.value
                            });
                        }
                    });
                }, 1000);
            }
        }

        // Clean storage after successful insertion
        chrome.storage.local.remove(['articleContentForGmail', 'articleToEmail', 'articleSubject']);
        window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'storage_cleared', {});
    });
}

function waitForGmailCompose(tries = 0) {
    console.log('UAS: Waiting for Gmail compose, attempt:', tries + 1);
    window.UAS_TRACE && UAS_TRACE.event('compose_wait_attempt', { attempt: tries + 1 });
    
    // Check multiple selectors for body
    const bodySelectors = [
        'div[aria-label="Message Body"]',
        'div[contenteditable="true"][aria-label="Message Body"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[g_editable="true"]',
        '.editable[contenteditable="true"]'
    ];
    
    let bodyFound = false;
    let foundElement = null;
    for (const selector of bodySelectors) {
        foundElement = document.querySelector(selector);
        if (foundElement) {
            const rect = foundElement.getBoundingClientRect();
            // Check that element is visible and large enough
            if (rect.width > 200 && rect.height > 50) {
                bodyFound = true;
                console.log('UAS: Gmail compose body found with selector:', selector, 'size:', rect.width + 'x' + rect.height);
                break;
            }
        }
    }
    
    // Additionally check for To and Subject fields
    const toExists = document.querySelector('input[aria-label*="To" i], textarea[aria-label*="To" i], input[name="to"], textarea[name="to"]');
    const subjectExists = document.querySelector('input[aria-label*="Subject" i], input[name="subject"], input[name="subjectbox"]');
    
    console.log('UAS: Compose elements status - Body:', bodyFound, 'To:', !!toExists, 'Subject:', !!subjectExists);
    
    if (bodyFound && toExists && subjectExists) {
        // All elements found, additional delay for full loading
        console.log('UAS: All compose elements found, inserting content');
        window.UAS_TRACE && UAS_TRACE.event('compose_all_elements_found', {});
        setTimeout(() => {
            insertToGmail();
        }, 500);
    } else if (tries < 50) { // Increased number of attempts
        setTimeout(() => waitForGmailCompose(tries + 1), 300); // Increased interval
    } else {
        console.error('UAS: Gmail compose not found after maximum attempts');
        console.log('UAS: Final attempt - running debug and trying insertion anyway');
        debugGmailElements();
        // Try to insert anyway, selectors might have changed
        insertToGmail();
        window.UAS_TRACE && UAS_TRACE.event('compose_max_attempts_reached', {});
    }
}

// Add DOM change observer
function observeGmailChanges() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // Look for compose elements
                const bodyElements = document.querySelectorAll('div[aria-label="Message Body"], div[contenteditable="true"][role="textbox"]');
                const toElements = document.querySelectorAll('input[aria-label*="To" i], textarea[aria-label*="To" i]');
                const subjectElements = document.querySelectorAll('input[aria-label*="Subject" i], input[name="subject"]');
                
                if (bodyElements.length > 0 && toElements.length > 0 && subjectElements.length > 0) {
                    console.log('UAS: Gmail composer detected via mutation observer - all elements found');
                    observer.disconnect(); // Stop observing
                    window.UAS_TRACE && UAS_TRACE.event('mutation_observer_detected_compose', {});
                    
                    // Check that we haven't already inserted content
                    chrome.storage.local.get(['articleContentForGmail'], (data) => {
                        if (data.articleContentForGmail) {
                            setTimeout(() => insertToGmail(), 300);
                        }
                    });
                    return;
                }
            }
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Stop observing after 30 seconds
    setTimeout(() => {
        observer.disconnect();
        console.log('UAS: Stopped observing Gmail changes after timeout');
    }, 30000);
}

// Additional check through intervals
function periodicCheck() {
    let attempts = 0;
    const maxAttempts = 20;
    
    const interval = setInterval(() => {
        attempts++;
        console.log('UAS: Periodic check attempt:', attempts);
        window.UAS_TRACE && UAS_TRACE.event('periodic_check_attempt', { attempt: attempts });
        
        chrome.storage.local.get(['articleContentForGmail'], (data) => {
            if (data.articleContentForGmail) {
                const bodySelectors = [
                    'div[aria-label="Message Body"]',
                    'div[contenteditable="true"][aria-label="Message Body"]',
                    'div[contenteditable="true"][role="textbox"]',
                    'div[g_editable="true"]',
                    '.editable[contenteditable="true"]'
                ];
                
                for (const selector of bodySelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const rect = element.getBoundingClientRect();
                        const hasContent = element.innerHTML.includes('Source:');
                        
                        // Check that element is visible, large enough and not yet filled
                        if (rect.width > 200 && rect.height > 50 && !hasContent) {
                            console.log('UAS: Found composer via periodic check, inserting content');
                            window.UAS_TRACE && UAS_TRACE.event('periodic_check_compose_found', {});
                            clearInterval(interval);
                            insertToGmail();
                            return;
                        }
                    }
                }
                
                // If not found through main selectors, try alternatives
                const allEditables = document.querySelectorAll('[contenteditable="true"]');
                for (const el of allEditables) {
                    const rect = el.getBoundingClientRect();
                    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                    const hasContent = el.innerHTML.includes('Source:');
                    
                    // Large editable area that is not To or Subject field
                    if (rect.width > 300 && rect.height > 100 && !hasContent &&
                        !ariaLabel.includes('to') && !ariaLabel.includes('subject')) {
                        console.log('UAS: Found large editable area via periodic check, inserting content');
                        window.UAS_TRACE && UAS_TRACE.event('periodic_check_large_editable_found', {});
                        clearInterval(interval);
                        insertToGmail();
                        return;
                    }
                }
            }
        });
        
        if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.log('UAS: Periodic check completed');
            window.UAS_TRACE && UAS_TRACE.event('periodic_check_completed', {});
        }
    }, 1000);
}

// Run all methods
waitForGmailCompose();
observeGmailChanges();

// Run periodic check after 3 seconds
setTimeout(() => {
    periodicCheck();
}, 3000);