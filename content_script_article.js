(async function () {
    function getConfigs() {
        return new Promise(res =>
            chrome.storage.local.get({ siteConfigs: [] }, d => res(d.siteConfigs))
        );
    }

    function findConfig(configs) {
        for (const c of configs)
            if (c.hostPattern && (new RegExp(c.hostPattern)).test(location.href)) return c;
        return null;
    }

    function findArticleElement(cfg) {
        for (const sel of cfg.selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    async function addButton(force) {
        if (document.getElementById('uas-ext-btn') && !force) return;
        const configs = await getConfigs();
        const config = findConfig(configs);
        if (!config) {
            window.UAS_TRACE && UAS_TRACE.event('no_config_match', { url: location.href });
            return;
        }
        const el = findArticleElement(config);
        if (!el) {
            window.UAS_TRACE && UAS_TRACE.event('article_element_not_found', { url: location.href });
            return;
        }
        window.UAS_TRACE && UAS_TRACE.event('article_element_found', { selectorCount: config.selectors.length });

        let btn = document.getElementById('uas-ext-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'uas-ext-btn';
            btn.textContent = 'Send Article to Gmail';
            Object.assign(btn.style, {
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                zIndex: 99999,
                padding: '8px 16px',
                background: '#348ceb',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                borderRadius: '6px',
                border: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
            });
            
            // Add hover and active states
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#2c7cd1';
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 3px 8px rgba(0,0,0,0.2)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#348ceb';
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
            });
            
            btn.addEventListener('mousedown', () => {
                btn.style.transform = 'translateY(1px)';
            });
            
            btn.addEventListener('mouseup', () => {
                btn.style.transform = 'translateY(-1px)';
            });
            
            btn.onclick = () => {
                const el = findArticleElement(config);
                if (!el) {
                    alert('Article not found!');
                    window.UAS_TRACE && UAS_TRACE.event('article_click_missing', {});
                    return;
                }
                const span = window.UAS_TRACE ? UAS_TRACE.startSpan('extract_and_store', { url: location.href }) : null;
                const html = `<h1>${document.title}</h1>
<p><strong>Source:</strong> <a href="${location.href}" target="_blank">${location.href}</a></p>
${el.outerHTML}`;

                // Toast helper (lazy create)
                function showToast(msg, ok){
                    let c = document.getElementById('uas-toast-container');
                    if(!c){
                        c = document.createElement('div');
                        c.id='uas-toast-container';
                        Object.assign(c.style,{position:'fixed',bottom:'20px',left:'20px',zIndex:99999,display:'flex',flexDirection:'column',gap:'6px'});
                        document.body.appendChild(c);
                    }
                    const t = document.createElement('div');
                    t.textContent = msg;
                    Object.assign(t.style,{background: ok?'#2e7d32':'#c62828',color:'#fff',padding:'8px 12px',borderRadius:'4px',fontSize:'13px',boxShadow:'0 2px 6px rgba(0,0,0,0.2)',opacity:'0',transition:'opacity .25s'});
                    c.appendChild(t);
                    requestAnimationFrame(()=>{t.style.opacity='1';});
                    setTimeout(()=>{t.style.opacity='0'; setTimeout(()=> t.remove(),400);}, 3000);
                }

                chrome.storage.local.get({ userSettings: { clipboardEnabled: true, clipboardPlainTextOnly: false, toastEnabled: true } }, store => {
                    const settings = store.userSettings || {};
                    if (settings.clipboardEnabled !== false) {
                        const copySpan = window.UAS_TRACE ? UAS_TRACE.startSpan('clipboard_copy', {}) : null;
                        const plainText = html.replace(/<[^>]+>/g,'');
                        const attemptClipboard = async () => {
                            let success = false;
                            const doHtml = !settings.clipboardPlainTextOnly;
                            try {
                                if (navigator.clipboard && window.ClipboardItem && doHtml) {
                                    const item = new ClipboardItem({
                                        'text/html': new Blob([html], { type: 'text/html' }),
                                        'text/plain': new Blob([plainText], { type: 'text/plain' })
                                    });
                                    await navigator.clipboard.write([item]);
                                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_write_api_success', { bytes: html.length, mode:'html+text' });
                                    success = true;
                                    window.UAS_TRACE && UAS_TRACE.endSpan(copySpan, { method: 'ClipboardItem' });
                                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                                    await navigator.clipboard.writeText(settings.clipboardPlainTextOnly ? plainText : html);
                                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_write_text_success', { bytes: html.length, mode: settings.clipboardPlainTextOnly?'text':'html' });
                                    success = true;
                                    window.UAS_TRACE && UAS_TRACE.endSpan(copySpan, { method: 'writeText' });
                                }
                            } catch (e) {
                                window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_primary_failed', { error: e.message });
                            }
                            if (!success) {
                                try {
                                    const ta = document.createElement('textarea');
                                    ta.value = settings.clipboardPlainTextOnly ? plainText : html;
                                    ta.style.position = 'fixed';
                                    ta.style.top = '-1000px';
                                    document.body.appendChild(ta);
                                    ta.focus(); ta.select();
                                    success = document.execCommand('copy');
                                    document.body.removeChild(ta);
                                    if (success) {
                                        window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_execCommand_success', { mode: settings.clipboardPlainTextOnly?'text':'html' });
                                        window.UAS_TRACE && UAS_TRACE.endSpan(copySpan, { method: 'execCommand' });
                                    } else {
                                        window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_execCommand_failed', {});
                                    }
                                } catch (e2) {
                                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_fallback_error', { error: e2.message });
                                }
                            }
                            if (!success) window.UAS_TRACE && UAS_TRACE.endSpan(copySpan, { status: 'failed' });
                            if (settings.toastEnabled !== false) {
                                showToast(success ? (settings.clipboardPlainTextOnly? 'Copied plain text to clipboard':'Copied HTML to clipboard') : 'Clipboard copy failed', success);
                            }
                        };
                        attemptClipboard();
                    }
                });
                
                console.log('UAS: Saving article content to storage');
                chrome.storage.local.set({
                    articleContentForGmail: html,
                    articleToEmail: config.defaultRecipient || config.toEmail || "",
                    articleSubject: document.title
                }, () => {
                    console.log('UAS: Article content saved, opening Gmail');
                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'stored_in_chrome_storage', { bytes: html.length });
                    // Small delay to ensure storage is saved
                    setTimeout(() => {
                        // Open specifically POPUP, not tab
                        window.open(
                            'https://mail.google.com/mail/?view=cm&fs=1',
                            'uas_gmail_popup',
                            'popup,width=900,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
                        );
                        window.UAS_TRACE && UAS_TRACE.endSpan(span, { status: 'opened_gmail_popup' });
                    }, 100);
                });
            };
            document.body.appendChild(btn);
        }
    }

    function observeUrlAndDomChanges() {
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                addButton(true);
            }
        }, 700);

        const obs = new MutationObserver(() => {
            addButton(true);
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('DOMContentLoaded', () => { window.UAS_TRACE && UAS_TRACE.event('dom_content_loaded', {}); addButton(); });
    window.addEventListener('load', () => { window.UAS_TRACE && UAS_TRACE.event('window_load', {}); addButton(true); });
    observeUrlAndDomChanges();

})();