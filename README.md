# Universal Article to Gmail Extension

A Chrome extension that allows you to easily copy articles with formatting and automatically insert them into Gmail compose. Features configurable selectors for different websites and intelligent field detection.

## Features

- **One-click article extraction** from any website
- **Automatic Gmail integration** with compose window pre-filling
- **Default recipient auto-fill** - set default email addresses per site
- **Configurable selectors** for different websites
- **Interactive XPath picker** for selecting article elements directly from the active page
- **CSS and XPath selector support** for article extraction
- **Stable rule editing** with reduced flicker, caret preservation, and automatic focus on newly added site rules
- **Intelligent field detection** for To, Subject, and Body fields
- **Enhanced stability** with multiple fallback selectors
- **Comprehensive debugging tools** for troubleshooting
- **JSON import/export** of site configurations
- **Tracing spans & events** for diagnostics (`tracing.js`)
- **Automatic clipboard copy** with configurable modes
- **Toast notifications** for copy success/failure
- **Responsive image best-fit** sizing in Gmail body

## Installation

1. **Download or clone** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top right)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access
6. **Open Side Panel**: Click the extension icon and choose "Open side panel" (or use Chrome side panel toggle and select the extension).

## Configuration

1. **Click the extension icon** to open the configuration popup
2. **Add site configurations**:
   - **Name**: Friendly name for the site
   - **Host Pattern**: Regular expression matching the site URL
   - **Selectors**: CSS selectors or XPath selectors for article content (multiple selectors supported)
   - Use **Pick** next to a selector to hover elements on the active page and click one to save a unique indexed XPath.
   - New site rules automatically focus the Name field, and edits are saved without refreshing the card on every keystroke.

### Example Configurations

```javascript
// Habr.com
Name: Habr
Host Pattern: habr\.com
Selectors: [data-test-id="article-body"]

// Medium
Name: Medium  
Host Pattern: medium\.com
Selectors: article, .postArticle-content

// Dev.to
Name: Dev.To
Host Pattern: dev\.to
Selectors: .crayons-article__main
```

## Usage

1. **Open side panel** to configure sites (instead of popup)
2. **Navigate to an article** on a configured website
3. **Click "Send Article to Gmail"** button (appears on supported sites)
4. **Gmail compose window opens** with:
   - **To field**: Pre-filled with configured email
   - **Subject**: Article title
   - **Body**: Article content with source link
5. Optional: Clipboard already contains the copied content (HTML or plain text per settings)

### Clipboard & Toast Settings

Open the popup Settings section to toggle:
- Enable automatic clipboard copy (on by default)
- Copy as plain text only (disables HTML flavor)
- Show toast notifications (success/failure feedback)

### Import / Export Configurations

**UI Buttons (Side Panel/Popup):**
- Click `Export JSON` to download `siteConfigs.json` backup.
- Click `Import JSON` and choose a previously exported file to replace all configs.
- Validation ensures each config has `hostPattern` and `selectors` (backwards compatible with legacy `toEmail`).

**Console Commands (Side Panel/Popup):**

Open side panel, press F12, open the Console tab, then use:

```javascript
// List all configs in table format
UAS_CONFIG_LIST()

// Export to console and clipboard
UAS_CONFIG_EXPORT()

// Import from JSON string or array
UAS_CONFIG_IMPORT('[{"name":"Site","hostPattern":"example\\.com","selectors":[".article"]}]')

// Export from old extension version (all storage)
UAS_EXPORT_OLD()
```

**For Old Extension Versions (Manual Migration):**

Export from old version console:
```javascript
chrome.storage.local.get({ siteConfigs: [] }, d => {
  console.table(d.siteConfigs);
  console.log(JSON.stringify(d.siteConfigs, null, 2));
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(JSON.stringify(d.siteConfigs, null, 2));
    console.log('Copied to clipboard');
  }
});
```

Import into old version console:
```javascript
chrome.storage.local.set({ siteConfigs: [
  /* paste your JSON array here */
]}, () => {
  console.log('Imported');
  location.reload();
});
```

### Tracing & Diagnostics

The extension emits lightweight spans/events for key actions (extraction, clipboard copy, Gmail insertion). In DevTools console:
```javascript
UAS_TRACE_DUMP(); // table of recent spans/events
```
Background trace buffer accessible:
```javascript
chrome.runtime.sendMessage({type:'UAS_TRACE_GET'}, r => console.log(r.traces));
```

### Image Handling
Inserted article images are auto-adjusted to fit Gmail compose width (`max-width:100%; height:auto;`).

## Advanced Features

### Debug Console Commands

Open Gmail and press F12 to access developer console, then use:

```javascript
// Analyze all Gmail elements
UAS_DEBUG.checkGmailElements();

// Test To field population
UAS_DEBUG.testToField('your-email@example.com');

// Test Subject field population  
UAS_DEBUG.testSubjectField('Your Subject');

// Force content insertion
UAS_DEBUG.forceInsert();

// Check storage contents
UAS_DEBUG.checkStorage();
```

### Troubleshooting

#### To Field Not Populating

1. **Open Gmail** and developer console (F12)
2. **Run element analysis**:
   ```javascript
   UAS_DEBUG.checkGmailElements();
   ```
3. **Look for To field candidates** in the output
4. **Test field population**:
   ```javascript
   UAS_DEBUG.testToField('test@example.com');
   ```

#### Body Content Not Inserting

1. **Check if compose window is fully loaded**
2. **Refresh Gmail page** after saving article
3. **Try opening Gmail in a new tab** instead of popup
4. **Run debug analysis** to identify correct selectors

## Technical Details

### Gmail Field Detection

The extension uses multiple strategies to find Gmail fields:

**To Field Selectors:**
- `input[aria-label*="To" i]` - By aria-label
- `div[role="combobox"][aria-label*="To" i]` - Modern Gmail elements
- `input[type="email"]` - By field type
- Contextual analysis of parent elements

**Subject Field Selectors:**
- `input[name="subject"]` and `input[name="subjectbox"]`
- `input[aria-label*="Subject" i]` - By aria-label
- `div.aoT input` - Gmail-specific selectors

**Body Field Detection:**
- Size and visibility validation
- Exclusion of To/Subject fields
- Multiple contenteditable selectors

### Waiting Mechanisms

1. **Initial wait** for compose elements to load
2. **MutationObserver** for DOM changes
3. **Periodic checks** as fallback
4. **Element validation** (size, visibility, context)

## File Structure

```
|-- manifest.json              # Extension manifest
|-- background.js              # Service worker
|-- content_script_gmail.js    # Gmail integration
|-- content_script_article.js  # Article extraction
|-- popup.html                 # Configuration interface
|-- popup.js                   # Configuration logic
|-- debug.js                   # Debug utilities
|-- style.css                  # Popup styles
|-- test_gmail.html            # Testing tool
`-- icon128.png                # Extension icon
```

## Known Issues and Solutions

| Issue | Solution |
|-------|----------|
| Fields not populating | Run `UAS_DEBUG.checkGmailElements()` to identify selectors |
| Content insertion fails | Check element size validation and visibility |
| Extension not detecting article | Verify site configuration and selectors |

## Version History

### v1.6.2 - Rule Editing Stability
- Reduced flicker while typing in site rules by ignoring storage refreshes caused by the current edit session.
- Kept the text cursor stable when editing fields and selectors.
- Focus now moves to the new rule's Name field after clicking `Add Site`.
- Site card titles update live while editing the Name field.

### v1.6.1 - Interactive XPath Picker
- Added a `Pick` action for selector fields that highlights page elements and inserts a unique indexed XPath on click.
- Added XPath support to article extraction while keeping existing CSS selectors compatible.
- Fixed rule focus restoration so duplicate selector or host values no longer move editing focus to another rule.

### v1.6.0 - UI Refresh and Reliability Fixes
- Refreshed side panel and popup UI with cleaner config cards, sticky tools, site count, search clear, duplicate site, and empty states.
- Fixed filtered config edits so search results no longer overwrite the full saved site list.
- Fixed Gmail pending article cleanup so stored article data is cleared only after successful body insertion.
- Improved Gmail compose body detection for the `?fs=1&tf=cm` compose popup and retry flow.

### v1.4.1 - Side Panel Migration
- Replaced popup with Chrome side panel (`sidepanel.html`).
- Updated manifest to include `side_panel` entry.
- Maintains all previous settings & functionality.

### v1.4.0 - Settings, Clipboard, Tracing & Import/Export
- Added JSON import/export of site configurations.
- Integrated tracing module (`tracing.js`) with spans/events.
- Automatic clipboard copy (HTML+plain text) with settings to disable and plain-text-only mode.
- Toast notifications for clipboard success/failure.
- Responsive best-fit image sizing in Gmail compose body.
- Added user settings persistence (`userSettings`).
- Minor UI enhancements in popup.

### v1.3.1 - (Unreleased internal) Added clipboard permission & groundwork for tracing.

### v1.2 - Enhanced Field Detection
- Extended selectors for all Gmail fields (15+ for To field)
- Improved field population logic with focus and event triggers
- Enhanced debugging with element analysis
- Better waiting mechanisms for Gmail loading

### v1.1 - Stability Improvements  
- Multiple selector fallbacks
- MutationObserver for DOM changes
- Enhanced logging and debugging
- Improved timing and delays

### v1.0 - Initial Release
- Basic article extraction
- Gmail compose integration
- Configurable site selectors

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter issues:

1. **Check the troubleshooting guide** above
2. **Use the debug console commands**
3. **Open an issue** with debug output
4. **Include Chrome version** and Gmail interface language

---

**Made for productivity and automation**
