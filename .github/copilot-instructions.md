# Universal Article to Gmail Extension - AI Coding Instructions

## Architecture Overview

This is a Chrome Extension (Manifest V3) that extracts articles from websites and automatically inserts them into Gmail compose windows. The extension uses a **dual content script pattern**:

- `content_script_article.js` - Runs on all websites, detects articles, shows extraction button
- `content_script_gmail.js` - Runs only on Gmail, handles auto-paste and field population
- Data flows through **Chrome Storage API** between scripts

## Key Components & Data Flow

### 1. Configuration System (`popup.js` + `popup.html`)
Site configurations stored in `chrome.storage.local.siteConfigs[]`:
```javascript
{
  name: "Habr",
  hostPattern: "habr\\.com",  // RegExp string
  defaultRecipient: "user@example.com", 
  selectors: ["[data-test-id='article-body']", "div.article-content"]
}
```

**Critical Pattern**: Debounced saving (300ms) prevents popup re-rendering during typing:
```javascript
let saveTimeout;
function saveConfigs(configs) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => chrome.storage.local.set({siteConfigs: configs}), 300);
}
```

### 2. Article Detection & Button Injection (`content_script_article.js`)
- Uses `findConfig()` to match current URL against `hostPattern` regexes
- Uses `findArticleElement()` to test selectors sequentially until match found
- Injects floating button with compact styling (8px padding, 14px font, blue theme)
- **Button behavior**: Extracts HTML → saves to storage → opens Gmail popup window

### 3. Gmail Integration (`content_script_gmail.js`)
**Multi-strategy approach** for finding Gmail compose fields:

```javascript
// Body field: 15+ selectors with size validation (>200x50px)
const bodySelectors = ['div[aria-label="Message Body"]', 'div[contenteditable="true"][role="textbox"]', ...]

// To field: Contextual analysis + aria-label matching
const toSelectors = ['input[aria-label*="To" i]', 'textarea[name="to"]', ...]
```

**Timing mechanisms**: 3 parallel approaches for Gmail detection:
1. `waitForGmailCompose()` - Polling with 50 attempts × 300ms intervals
2. `observeGmailChanges()` - MutationObserver for DOM changes
3. `periodicCheck()` - Interval-based fallback checking

## Development Patterns

### Console Logging Convention
All logs use `"UAS:"` prefix for easy filtering:
```javascript
console.log('UAS: Article content saved, opening Gmail');
console.warn('UAS: Body element not found');
console.error('UAS: Gmail compose not found after maximum attempts');
```

### Storage Keys & Lifecycle
```javascript
// Temporary data (cleared after use)
chrome.storage.local.set({
  articleContentForGmail: htmlContent,
  articleToEmail: recipientEmail,
  articleSubject: pageTitle
});

// Persistent configuration
chrome.storage.local.set({ siteConfigs: [...] });
```

### Backwards Compatibility Pattern
```javascript
// Support both old 'toEmail' and new 'defaultRecipient' fields
articleToEmail: config.defaultRecipient || config.toEmail || ""
```

## Debugging Workflows

### Built-in Debug Tools (`debug.js`)
Access via browser console on Gmail pages:
```javascript
UAS_DEBUG.checkGmailElements();     // Analyze all Gmail form fields
UAS_DEBUG.testToField('test@email.com'); // Test recipient population
UAS_DEBUG.forceInsert();            // Force content insertion
UAS_DEBUG.checkStorage();           // View stored article data
```

### Common Issues & Debugging Steps
1. **Button not appearing**: Check site config `hostPattern` regex and `selectors`
2. **Gmail fields not populating**: Run `UAS_DEBUG.checkGmailElements()` to identify current Gmail selectors
3. **Content not inserting**: Verify compose window timing - Gmail loads dynamically

## Extension Development Commands

### Loading/Testing
```bash
# Load unpacked extension in Chrome
# Navigate to chrome://extensions/, enable Developer mode, click "Load unpacked"

# Test on included test page
# Open image-test.html - contains various image types for testing
```

### Manifest V3 Specifics
- **Service Worker**: `background.js` (lightweight, for message passing only)
- **Content Script Injection**: Automatic via manifest, not programmatic
- **Permissions**: `storage` + `host_permissions` for all URLs and Gmail

## Code Style & Conventions

### Element Creation Helper (`popup.js`)
```javascript
function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) for (let k in attrs) e[k] = attrs[k];
  for (const c of children) e.appendChild(typeof c == 'string' ? document.createTextNode(c) : c);
  return e;
}
```

### Gmail Selector Strategy
Always use **multiple selectors with validation**:
- Start with aria-label attributes (most stable)
- Add element size checks (`rect.width > 200 && rect.height > 50`)
- Exclude false positives (elements containing "To" or "Subject" in labels)
- Fall back to broad contenteditable searches

### Error Handling Pattern
```javascript
try {
  // Primary approach
} catch (e) {
  console.warn('UAS: Primary method failed:', e);
  // Fallback approach
}
```

## Testing Strategy

Use `image-test.html` for comprehensive testing:
- Various image types (small, large, broken, SVG, background CSS)
- Console logging for clipboard operations
- Gmail integration testing workflow

The extension uses **clipboard-based data transfer** as primary method with storage fallback, ensuring reliable cross-tab communication.
