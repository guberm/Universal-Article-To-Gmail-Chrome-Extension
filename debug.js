// Debug utility for Universal Article to Gmail Extension
// Include this file for debugging issues

window.UAS_DEBUG = {
    log: (message, data = null) => {
        console.log(`[UAS Debug] ${message}`, data);
    },
    
    checkGmailElements: () => {
        const selectors = [
            // Body selectors
            'div[aria-label="Message Body"]',
            'div[contenteditable="true"][aria-label="Message Body"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[g_editable="true"]',
            '.editable[contenteditable="true"]',
            // To field selectors
            'textarea[name="to"]',
            'input[name="to"]',
            'div[data-name="to"] textarea',
            'div[data-name="to"] input',
            'input[aria-label*="To" i]',
            'textarea[aria-label*="To" i]',
            // Subject selectors
            'input[name="subjectbox"]',
            'input[name="subject"]',
            'input[placeholder*="Subject" i]',
            'input[aria-label*="Subject" i]'
        ];
        
        console.log('[UAS Debug] Gmail elements check:');
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            console.log(`${selector}: ${elements.length > 0 ? `FOUND (${elements.length})` : 'NOT FOUND'}`);
            if (elements.length > 0) {
                elements.forEach((el, index) => {
                    const rect = el.getBoundingClientRect();
                    console.log(`  Element ${index}:`, {
                        visible: rect.width > 0 && rect.height > 0,
                        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                        ariaLabel: el.getAttribute('aria-label'),
                        className: el.className
                    });
                });
            }
        });
        
        // Additional analysis of all input elements
        console.log('[UAS Debug] All input elements analysis:');
        const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
        let toFieldCandidates = [];
        let subjectFieldCandidates = [];
        let bodyFieldCandidates = [];
        
        allInputs.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                const placeholder = el.getAttribute('placeholder')?.toLowerCase() || '';
                const name = el.getAttribute('name')?.toLowerCase() || '';
                const className = el.className.toLowerCase();
                
                if (ariaLabel.includes('to') || placeholder.includes('recipient') || name.includes('to')) {
                    toFieldCandidates.push({index, el, reason: 'Contains "to" or "recipient"'});
                }
                if (ariaLabel.includes('subject') || placeholder.includes('subject') || name.includes('subject')) {
                    subjectFieldCandidates.push({index, el, reason: 'Contains "subject"'});
                }
                if (el.contentEditable === 'true' && rect.height > 50 && rect.width > 200) {
                    bodyFieldCandidates.push({index, el, reason: 'Large contenteditable area'});
                }
            }
        });
        
        console.log('[UAS Debug] To field candidates:', toFieldCandidates.length);
        toFieldCandidates.forEach(candidate => {
            console.log(`  Candidate ${candidate.index}: ${candidate.reason}`, candidate.el);
        });
        
        console.log('[UAS Debug] Subject field candidates:', subjectFieldCandidates.length);
        subjectFieldCandidates.forEach(candidate => {
            console.log(`  Candidate ${candidate.index}: ${candidate.reason}`, candidate.el);
        });
        
        console.log('[UAS Debug] Body field candidates:', bodyFieldCandidates.length);
        bodyFieldCandidates.forEach(candidate => {
            console.log(`  Candidate ${candidate.index}: ${candidate.reason}`, candidate.el);
        });
    },
    
    checkStorage: () => {
        chrome.storage.local.get(['articleContentForGmail', 'articleToEmail', 'articleSubject'], (data) => {
            console.log('[UAS Debug] Storage contents:', data);
        });
    },
    
    forceInsert: () => {
        console.log('[UAS Debug] Force inserting article content...');
        if (typeof insertToGmail === 'function') {
            insertToGmail();
        } else {
            console.error('[UAS Debug] insertToGmail function not found');
        }
    },
    
    testToField: (email = 'test@example.com') => {
        console.log('[UAS Debug] Testing To field population with:', email);
        
        const toSelectors = [
            'textarea[name="to"]',
            'input[name="to"]',
            'input[aria-label*="To" i]',
            'textarea[aria-label*="To" i]',
            'div[role="combobox"][aria-label*="To" i]'
        ];
        
        for (const selector of toSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                console.log(`[UAS Debug] Trying to fill element ${index} with selector: ${selector}`);
                element.focus();
                if (element.tagName.toLowerCase() === 'div') {
                    element.textContent = email;
                } else {
                    element.value = email;
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[UAS Debug] Filled element ${index}, current value:`, element.value || element.textContent);
            });
        }
    },
    
    testSubjectField: (subject = 'Test Subject') => {
        console.log('[UAS Debug] Testing Subject field population with:', subject);
        
        const subjectSelectors = [
            'input[name="subjectbox"]',
            'input[name="subject"]',
            'input[aria-label*="Subject" i]',
            'input[placeholder*="Subject" i]'
        ];
        
        for (const selector of subjectSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                console.log(`[UAS Debug] Trying to fill element ${index} with selector: ${selector}`);
                element.focus();
                element.value = subject;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[UAS Debug] Filled element ${index}, current value:`, element.value);
            });
        }
    }
};

// Export to global scope for console usage
if (typeof window !== 'undefined') {
    window.UAS_DEBUG = UAS_DEBUG;
}