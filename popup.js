function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (let k in attrs) {
        if (k.startsWith('data-')) {
            e.setAttribute(k, attrs[k]);
        } else {
            e[k] = attrs[k];
        }
    }
    for (const c of children) e.appendChild(typeof c == 'string' ? document.createTextNode(c) : c);
    return e;
}

let saveTimeout;
let ignoredSiteConfigChangeCount = 0;
let pendingFocusInfo = null;

function setSiteConfigs(configs, callback) {
    ignoredSiteConfigChangeCount += 1;
    chrome.storage.local.set({ siteConfigs: configs }, callback);
}

function requestFieldFocus(focusKey, selectionStart = 0, selectionEnd = 0) {
    pendingFocusInfo = { focusKey, selectionStart, selectionEnd };
}

function saveConfigs(configs) {
    // Debounce saving to prevent constant re-rendering while typing
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveTimeout = null;
        setSiteConfigs(configs);
    }, 300); // Wait 300ms after last keystroke
}

function saveConfigsNow(configs, callback) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    setSiteConfigs(configs, callback);
}

let searchQuery = '';
let activeXPathPickerKey = null;

async function startXPathPicker(configIndex, selectorIndex) {
    const pickerKey = `config:${configIndex}:selector:${selectorIndex}`;
    activeXPathPickerKey = pickerKey;
    render();

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab found');

        const response = await chrome.tabs.sendMessage(tab.id, { type: 'UAS_START_XPATH_PICKER' });
        if (!response || !response.xpath) return;

        chrome.storage.local.get({ siteConfigs: [] }, d => {
            const configs = d.siteConfigs;
            const config = configs[configIndex];
            if (!config || !Array.isArray(config.selectors) || selectorIndex >= config.selectors.length) {
                alert('Selector field no longer exists. Add a selector and try again.');
                return;
            }
            config.selectors[selectorIndex] = response.xpath;
            saveConfigsNow(configs, render);
        });
    } catch (err) {
        const message = err && err.message ? err.message : String(err);
        alert('XPath picker failed: ' + message + '\n\nOpen the target site in the active tab and try again.');
    } finally {
        activeXPathPickerKey = null;
        render();
    }
}

function render() {
    chrome.storage.local.get({ siteConfigs: [] }, d => {
        const allConfigs = d.siteConfigs;
        
        // Migrate existing toEmail to defaultRecipient for backwards compatibility
        let needsMigration = false;
        allConfigs.forEach(config => {
            if (config.toEmail && !config.defaultRecipient) {
                console.log('UAS Popup: Migrating toEmail to defaultRecipient for', config.name || 'unnamed site');
                config.defaultRecipient = config.toEmail;
                needsMigration = true;
            }
        });
        
        // Save the migrated config if needed
        if (needsMigration) {
            console.log('UAS Popup: Saving migrated configurations');
            setSiteConfigs(allConfigs);
        }
        
        // Filter by search query
        let configs = allConfigs;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            configs = allConfigs.filter(c => 
                (c.name && c.name.toLowerCase().includes(query)) ||
                (c.hostPattern && c.hostPattern.toLowerCase().includes(query))
            );
        }
        
        const root = document.getElementById('configs');
        const countEl = document.getElementById('configCount');
        const searchClearBtn = document.getElementById('clearSearchBtn');
        if (countEl) {
            countEl.textContent = searchQuery.trim()
                ? `${configs.length} of ${allConfigs.length} sites`
                : `${allConfigs.length} sites`;
        }
        if (searchClearBtn) {
            searchClearBtn.hidden = !searchQuery.trim();
        }
        
        // Preserve focus information
        const activeElement = document.activeElement;
        let focusInfo = pendingFocusInfo;
        pendingFocusInfo = null;
        if (activeElement && activeElement.tagName === 'INPUT' && root.contains(activeElement) && activeElement.dataset.focusKey) {
            focusInfo = {
                focusKey: activeElement.dataset.focusKey,
                selectionStart: activeElement.selectionStart,
                selectionEnd: activeElement.selectionEnd
            };
        }
        
        root.innerHTML = '';
        if (!configs.length) {
            root.appendChild(el('div', { className: 'empty-state' },
                el('div', { className: 'empty-title' }, searchQuery.trim() ? 'No matching sites' : 'No sites yet'),
                el('div', { className: 'empty-text' }, searchQuery.trim() ? 'Clear search or add a new site config.' : 'Add a site config to start sending articles to Gmail.')
            ));
            return;
        }

        configs.forEach((c) => {
            const configIndex = allConfigs.indexOf(c);
            const focusKey = (field, index) => `config:${configIndex}:${field}${index === undefined ? '' : `:${index}`}`;
            const saveAllConfigs = () => saveConfigs(allConfigs);
            const saveAllConfigsNow = () => saveConfigsNow(allConfigs, render);
            const cardTitle = c.name || '(unnamed site)';
            const selectorCountText = `${c.selectors.length} selector${c.selectors.length === 1 ? '' : 's'}`;
            const cardTitleEl = el('div', { className: 'config-card-title' }, cardTitle);
            const box = el('div', { className: 'config-box' },
                el('div', { className: 'config-card-header' },
                    cardTitleEl,
                    el('div', { className: 'config-card-meta' }, selectorCountText)
                ),
                el('div', { className: 'field-grid' },
                    el('label', { className: 'field-label' }, 'Name',
                        el('input', { type:'text', value:c.name, placeholder:'Website name', 'data-focus-key':focusKey('name'), oninput:e=>{ c.name=e.target.value; cardTitleEl.textContent = c.name || '(unnamed site)'; saveAllConfigs();} })
                    ),
                    el('label', { className: 'field-label' }, 'Host pattern',
                        el('input', { type:'text', value:c.hostPattern, placeholder:'example\\.com or https://site.com', 'data-focus-key':focusKey('hostPattern'), oninput:e=>{c.hostPattern=e.target.value; saveAllConfigs();}})
                    ),
                    el('label', { className: 'field-label wide' }, 'Default recipient',
                        el('input', { type:'email', value:c.defaultRecipient||'', placeholder:'email@example.com', 'data-focus-key':focusKey('defaultRecipient'), oninput:e=>{ c.defaultRecipient=e.target.value; saveAllConfigs();} })
                    )
                ),
                el('div', { className: 'section-row' },
                    el('span', { className: 'section-title' }, 'Selectors'),
                    el('button', { className:'small secondary', type:'button', onclick:()=>{ c.selectors.push(''); saveAllConfigsNow(); } }, '+ Selector')
                ),
                ...c.selectors.map((sel, sidx) =>
                    el('div', { className:'selector-row' },
                        el('input', { type:'text', value:sel, 'data-focus-key':focusKey('selector', sidx), oninput:e=>{ c.selectors[sidx]=e.target.value; saveAllConfigs();} }),
                        el('button', { className:'small secondary selector-pick-btn', type:'button', disabled: activeXPathPickerKey === focusKey('selector', sidx), title:'Pick XPath from active tab', onclick:()=>{ startXPathPicker(configIndex, sidx); } }, activeXPathPickerKey === focusKey('selector', sidx) ? 'Picking...' : 'Pick'),
                        el('button', { className:'icon-button danger-lite', type:'button', title:'Remove selector', onclick:()=>{ c.selectors.splice(sidx,1); saveAllConfigsNow(); } }, 'x')
                    )
                ),
                el('div', { className: 'card-actions' },
                    el('button', { className:'small secondary', type:'button', onclick:()=>{
                        if (configIndex >= 0) {
                            const copy = {
                                ...c,
                                name: `${c.name || 'Site'} copy`,
                                selectors: Array.isArray(c.selectors) ? [...c.selectors] : ['']
                            };
                            allConfigs.splice(configIndex + 1, 0, copy);
                            saveAllConfigsNow();
                        }
                    } }, 'Duplicate'),
                el('button', { className:'small', onclick:()=>{
                    if (configIndex >= 0) {
                        allConfigs.splice(configIndex, 1);
                        saveAllConfigsNow();
                    } else {
                        render();
                    }
                } }, 'Delete')
                )
            );
            root.appendChild(box);
        });
        
        // Restore focus if we had it before
        if (focusInfo) {
            setTimeout(() => {
                const input = root.querySelector(`input[data-focus-key="${focusInfo.focusKey}"]`);
                if (input) {
                    input.focus();
                    input.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
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
        const newConfigIndex = d.siteConfigs.length;
        d.siteConfigs.push({ name:'', hostPattern:'', defaultRecipient:'', selectors:[''] });
        requestFieldFocus(`config:${newConfigIndex}:name`);
        // Use immediate save for button clicks (no debouncing needed)
        setSiteConfigs(d.siteConfigs, () => {
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
            setSiteConfigs(parsed, () => {
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
    if (areaName !== 'local' || !changes.siteConfigs) return;

    if (ignoredSiteConfigChangeCount > 0) {
        ignoredSiteConfigChangeCount -= 1;
        return;
    }

    // Re-render for changes from another extension view or console helper.
    if (!saveTimeout) {
        render();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    render();
    
    // Search input handler
    const searchInput = document.getElementById('searchConfigs');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            render();
        });
    }

    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', () => {
            searchQuery = '';
            searchInput.value = '';
            render();
            searchInput.focus();
        });
    }
});

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
        setSiteConfigs(parsed, () => {
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
