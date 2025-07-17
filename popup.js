function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (let k in attrs) e[k] = attrs[k];
    for (const c of children) e.appendChild(typeof c == 'string' ? document.createTextNode(c) : c);
    return e;
}

function saveConfigs(configs) {
    chrome.storage.local.set({ siteConfigs: configs });
}

function render() {
    chrome.storage.local.get({ siteConfigs: [] }, d => {
        const configs = d.siteConfigs;
        const root = document.getElementById('configs');
        root.innerHTML = '';
        configs.forEach((c, idx) => {
            const box = el('div', { className: 'config-box' },
                el('div', null, 
                    el('input', { type:'text', value:c.name, placeholder:'Name', oninput:e=>{ c.name=e.target.value; saveConfigs(configs);} }),
                    el('input', { type:'text', value:c.hostPattern, placeholder:'Host RegExp', style:'margin-left:6px;width:60%;', oninput:e=>{c.hostPattern=e.target.value; saveConfigs(configs);}})
                ),
                el('div', null, 'Selectors:'),
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
    });
}

document.getElementById('addSiteBtn').onclick = ()=>{
    chrome.storage.local.get({ siteConfigs: [] }, d=>{
        d.siteConfigs.push({ name:'', hostPattern:'', selectors:[''] });
        chrome.storage.local.set({ siteConfigs: d.siteConfigs }, render);
    });
};

chrome.storage.onChanged.addListener(render);
document.addEventListener('DOMContentLoaded', render);