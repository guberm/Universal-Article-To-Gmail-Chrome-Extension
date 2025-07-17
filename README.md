# Universal Article to Gmail Extension

A Chrome extension that allows you to easily copy articles with formatting and automatically insert them into Gmail compose. Features configurable selectors for different websites and intelligent field detection.

## 🚀 Features

- **One-click article extraction** from any website
- **Automatic Gmail integration** with compose window pre-filling
- **Configurable selectors** for different websites
- **Intelligent field detection** for To, Subject, and Body fields
- **Enhanced stability** with multiple fallback selectors
- **Comprehensive debugging tools** for troubleshooting

## 📦 Installation

1. **Download or clone** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top right)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

## 🛠 Configuration

1. **Click the extension icon** to open the configuration popup
2. **Add site configurations**:
   - **Name**: Friendly name for the site
   - **Host Pattern**: Regular expression matching the site URL
   - **Selectors**: CSS selectors for article content (multiple selectors supported)

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

## 📋 Usage

1. **Navigate to an article** on a configured website
2. **Click "Send Article to Gmail"** button (appears on supported sites)
3. **Gmail compose window opens** with:
   - **To field**: Pre-filled with configured email
   - **Subject**: Article title
   - **Body**: Article content with source link

## 🔧 Advanced Features

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

## 🏗 Technical Details

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

## 📁 File Structure

```
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content_script_gmail.js    # Gmail integration
├── content_script_article.js # Article extraction
├── popup.html             # Configuration interface
├── popup.js               # Configuration logic
├── debug.js               # Debug utilities
├── style.css              # Popup styles
├── test_gmail.html        # Testing tool
└── icon128.png            # Extension icon
```

## 🐛 Known Issues & Solutions

| Issue | Solution |
|-------|----------|
| Fields not populating | Run `UAS_DEBUG.checkGmailElements()` to identify selectors |
| Content insertion fails | Check element size validation and visibility |
| Extension not detecting article | Verify site configuration and selectors |

## 🔄 Version History

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

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter issues:

1. **Check the troubleshooting guide** above
2. **Use the debug console commands**
3. **Open an issue** with debug output
4. **Include Chrome version** and Gmail interface language

---

**Made with ❤️ for productivity and automation**