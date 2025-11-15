function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (let k in attrs) e[k] = attrs[k];
    for (const c of children) e.appendChild(typeof c == 'string' ? document.createTextNode(c) : c);
    return e;
}

let saveTimeout;
function saveConfigs(configs) {
    // Debounce saving to prevent constant re-rendering while typing
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        chrome.storage.local.set({ siteConfigs: configs });
    }, 300); // Wait 300ms after last keystroke
}

function render() {
    chrome.storage.local.get({ siteConfigs: [] }, d => {
        const configs = d.siteConfigs;
        
        // Migrate existing toEmail to defaultRecipient for backwards compatibility
        let needsMigration = false;
        configs.forEach(config => {
            if (config.toEmail && !config.defaultRecipient) {
                console.log('UAS Popup: Migrating toEmail to defaultRecipient for', config.name || 'unnamed site');
                config.defaultRecipient = config.toEmail;
                needsMigration = true;
            }
        });
        
        // Save the migrated config if needed
        if (needsMigration) {
            console.log('UAS Popup: Saving migrated configurations');
            chrome.storage.local.set({ siteConfigs: configs });
        }
        
        const root = document.getElementById('configs');
        
        // Preserve focus information
        const activeElement = document.activeElement;
        let focusInfo = null;
        if (activeElement && activeElement.tagName === 'INPUT') {
            focusInfo = {
                value: activeElement.value,
                selectionStart: activeElement.selectionStart,
                selectionEnd: activeElement.selectionEnd,
                placeholder: activeElement.placeholder
            };
        }
        
        root.innerHTML = '';
        configs.forEach((c, idx) => {
            const box = el('div', { className: 'config-box' },
                el('div', null, 
                    el('input', { type:'text', value:c.name, placeholder:'Name', oninput:e=>{ c.name=e.target.value; saveConfigs(configs);} }),
                    el('input', { type:'text', value:c.hostPattern, placeholder:'Host RegExp', style:'margin-left:6px;width:60%;', oninput:e=>{c.hostPattern=e.target.value; saveConfigs(configs);}})
                ),
                el('div', { style:'margin-top:8px;' },
                    el('label', { style:'display:block;font-weight:bold;margin-bottom:4px;' }, 'Default Recipient:'),
                    el('input', { type:'email', value:c.defaultRecipient||'', placeholder:'email@example.com', style:'width:98%;', oninput:e=>{ c.defaultRecipient=e.target.value; saveConfigs(configs);} })
                ),
                el('div', { style:'margin-top:8px;' }, 'Selectors:'),
                ...c.selectors.map((sel, sidx) =>
                    el('div', { className:'selector-row' },
                        el('input', { type:'text', value:sel, oninput:e=>{ c.selectors[sidx]=e.target.value; saveConfigs(configs);} }),
                        el('button', { className:'small', onclick:()=>{ c.selectors.splice(sidx,1); saveConfigs(configs); render(); } }, '✕')
                    )
                ),
                el('button', { className:'small', onclick:()=>{ c.selectors.push(''); saveConfigs(configs); render(); } }, '+ selector'),
                el('button', { className:'small', onclick:()=>{ configs.splice(idx,1); saveConfigs(configs); render(); }, style:'float:right;background:#fbb;' }, 'Delete site')
            );
            root.appendChild(box);
        });
        
        // Restore focus if we had it before
        if (focusInfo) {
            setTimeout(() => {
                const inputs = root.querySelectorAll('input');
                for (const input of inputs) {
                    if (input.placeholder === focusInfo.placeholder && input.value === focusInfo.value) {
                        input.focus();
                        input.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
                        break;
                    }
                }
            }, 10);
        }
    });

    // Load settings
    chrome.storage.local.get({ userSettings: { clipboardEnabled: true, clipboardPlainTextOnly: false, toastEnabled: true } }, data => {
        const s = data.userSettings || {};
        const clipChk = document.getElementById('clipboardEnabledChk');
        const plainChk = document.getElementById('plainTextOnlyChk');
        const toastChk = document.getElementById('toastEnabledChk');
        if (clipChk) clipChk.checked = s.clipboardEnabled !== false; // default true
        if (plainChk) plainChk.checked = !!s.clipboardPlainTextOnly;
        if (toastChk) toastChk.checked = s.toastEnabled !== false; // default true
    });
}

document.getElementById('addSiteBtn').onclick = ()=>{
    chrome.storage.local.get({ siteConfigs: [] }, d=>{
        d.siteConfigs.push({ name:'', hostPattern:'', defaultRecipient:'', selectors:[''] });
        // Use immediate save for button clicks (no debouncing needed)
        chrome.storage.local.set({ siteConfigs: d.siteConfigs }, () => {
            render();
        });
    });
};

// Export siteConfigs to a downloadable JSON file
document.getElementById('exportBtn').onclick = () => {
    chrome.storage.local.get({ siteConfigs: [] }, d => {
        try {
            const json = JSON.stringify(d.siteConfigs, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'siteConfigs.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Export failed: ' + e.message);
        }
    });
};

// Import siteConfigs from selected JSON file
document.getElementById('importBtn').onclick = () => {
    document.getElementById('importFileInput').click();
};

document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            if (!Array.isArray(parsed)) throw new Error('Root JSON value must be an array');
            // Basic validation and normalization
            parsed.forEach((cfg, i) => {
                if (typeof cfg !== 'object' || cfg === null) throw new Error('Config at index ' + i + ' is not an object');
                if (typeof cfg.hostPattern !== 'string') throw new Error('Missing hostPattern at index ' + i);
                if (!Array.isArray(cfg.selectors)) throw new Error('Missing selectors array at index ' + i);
                if (!cfg.selectors.length) cfg.selectors = [''];
                // Backwards compatibility normalization
                if (cfg.toEmail && !cfg.defaultRecipient) cfg.defaultRecipient = cfg.toEmail;
                if (!('name' in cfg)) cfg.name = '';
                if (!('defaultRecipient' in cfg)) cfg.defaultRecipient = '';
            });
            chrome.storage.local.set({ siteConfigs: parsed }, () => {
                render();
                alert('Import successful: ' + parsed.length + ' site config(s) loaded');
            });
        } catch (err) {
            alert('Import failed: ' + err.message);
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsText(file);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    // Only re-render if this wasn't triggered by our own save
    if (areaName === 'local' && changes.siteConfigs && !saveTimeout) {
        render();
    }
});
document.addEventListener('DOMContentLoaded', render);

// Settings change handlers
document.getElementById('clipboardEnabledChk').addEventListener('change', () => {
    chrome.storage.local.get({ userSettings: { clipboardEnabled: true, clipboardPlainTextOnly: false, toastEnabled: true } }, d => {
        d.userSettings.clipboardEnabled = document.getElementById('clipboardEnabledChk').checked;
        chrome.storage.local.set({ userSettings: d.userSettings });
    });
});
document.getElementById('plainTextOnlyChk').addEventListener('change', () => {
    chrome.storage.local.get({ userSettings: { clipboardEnabled: true, clipboardPlainTextOnly: false, toastEnabled: true } }, d => {
        d.userSettings.clipboardPlainTextOnly = document.getElementById('plainTextOnlyChk').checked;
        chrome.storage.local.set({ userSettings: d.userSettings });
    });
});
document.getElementById('toastEnabledChk').addEventListener('change', () => {
    chrome.storage.local.get({ userSettings: { clipboardEnabled: true, clipboardPlainTextOnly: false, toastEnabled: true } }, d => {
        d.userSettings.toastEnabled = document.getElementById('toastEnabledChk').checked;
        chrome.storage.local.set({ userSettings: d.userSettings });
    });
});

// Console helpers for export/import via clipboard
window.UAS_CONFIG_LIST = function() {
    chrome.storage.local.get({ siteConfigs: [] }, d => {
        console.table(d.siteConfigs.map((c, i) => ({
            index: i,
            name: c.name || '(unnamed)',
            hostPattern: c.hostPattern,
            recipient: c.defaultRecipient || c.toEmail || '(none)',
            selectors: c.selectors.length + ' selector(s)'
        })));
        console.log('Full configs object:', d.siteConfigs);
        return d.siteConfigs;
    });
};

window.UAS_CONFIG_EXPORT = function() {
    chrome.storage.local.get({ siteConfigs: [] }, d => {
        const json = JSON.stringify(d.siteConfigs, null, 2);
        console.log('=== SITE CONFIGS (copy below) ===');
        console.log(json);
        console.log('=== END ===');
        // Try to copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(() => {
                console.log('✓ Copied to clipboard! Paste anywhere to save.');
            }).catch(() => {
                console.log('⚠ Copy failed, select and copy the JSON above manually.');
            });
        } else {
            console.log('⚠ Clipboard API unavailable, select and copy the JSON above manually.');
        }
        return d.siteConfigs;
    });
};

window.UAS_CONFIG_IMPORT = function(jsonStringOrArray) {
    try {
        const parsed = typeof jsonStringOrArray === 'string' ? JSON.parse(jsonStringOrArray) : jsonStringOrArray;
        if (!Array.isArray(parsed)) throw new Error('Must be an array of configs');
        parsed.forEach((cfg, i) => {
            if (typeof cfg !== 'object' || cfg === null) throw new Error('Config at index ' + i + ' is not an object');
            if (typeof cfg.hostPattern !== 'string') throw new Error('Missing hostPattern at index ' + i);
            if (!Array.isArray(cfg.selectors)) throw new Error('Missing selectors array at index ' + i);
            if (!cfg.selectors.length) cfg.selectors = [''];
            if (cfg.toEmail && !cfg.defaultRecipient) cfg.defaultRecipient = cfg.toEmail;
            if (!('name' in cfg)) cfg.name = '';
            if (!('defaultRecipient' in cfg)) cfg.defaultRecipient = '';
        });
        chrome.storage.local.set({ siteConfigs: parsed }, () => {
            console.log('✓ Imported', parsed.length, 'config(s). Refresh side panel to see changes.');
            if (typeof render === 'function') render();
        });
        return parsed;
    } catch (e) {
        console.error('✗ Import failed:', e.message);
        return null;
    }
};

// Backward compatibility for old extension versions
window.UAS_EXPORT_OLD = function() {
    chrome.storage.local.get(null, allData => {
        console.log('=== ALL EXTENSION DATA (old version format) ===');
        console.log(JSON.stringify(allData, null, 2));
        console.log('=== siteConfigs only ===');
        console.log(JSON.stringify(allData.siteConfigs || [], null, 2));
        if (navigator.clipboard && navigator.clipboard.writeText) {
            const json = JSON.stringify(allData.siteConfigs || [], null, 2);
            navigator.clipboard.writeText(json).then(() => {
                console.log('✓ siteConfigs copied to clipboard');
            });
        }
        return allData;
    });
};

console.log('UAS Console Helpers Available:');
console.log('  UAS_CONFIG_LIST() - show current configs in table format');
console.log('  UAS_CONFIG_EXPORT() - exports configs to console and clipboard');
console.log('  UAS_CONFIG_IMPORT(jsonString) - imports from JSON string or array');
console.log('  UAS_EXPORT_OLD() - export from old extension version (all storage data)');