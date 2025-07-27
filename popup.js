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

chrome.storage.onChanged.addListener((changes, areaName) => {
    // Only re-render if this wasn't triggered by our own save
    if (areaName === 'local' && changes.siteConfigs && !saveTimeout) {
        render();
    }
});
document.addEventListener('DOMContentLoaded', render);