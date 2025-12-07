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

    function convertRelativeUrls(html) {
        const baseUrl = `${location.protocol}//${location.host}`;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Convert relative URLs in img src attributes
        tempDiv.querySelectorAll('img[src]').forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('/') && !src.startsWith('//')) {
                img.setAttribute('src', baseUrl + src);
            }
        });
        
        // Convert relative URLs in srcset attributes
        tempDiv.querySelectorAll('img[srcset]').forEach(img => {
            const srcset = img.getAttribute('srcset');
            if (srcset) {
                const newSrcset = srcset.split(',').map(part => {
                    const [url, descriptor] = part.trim().split(/\s+/);
                    if (url && url.startsWith('/') && !url.startsWith('//')) {
                        return (baseUrl + url) + (descriptor ? ' ' + descriptor : '');
                    }
                    return part.trim();
                }).join(', ');
                img.setAttribute('srcset', newSrcset);
            }
        });
        
        // Convert relative URLs in picture source elements
        tempDiv.querySelectorAll('source[srcset]').forEach(source => {
            const srcset = source.getAttribute('srcset');
            if (srcset) {
                const newSrcset = srcset.split(',').map(part => {
                    const [url, descriptor] = part.trim().split(/\s+/);
                    if (url && url.startsWith('/') && !url.startsWith('//')) {
                        return (baseUrl + url) + (descriptor ? ' ' + descriptor : '');
                    }
                    return part.trim();
                }).join(', ');
                source.setAttribute('srcset', newSrcset);
            }
        });
        
        // Convert relative URLs in background images
        tempDiv.querySelectorAll('[style*="background"]').forEach(el => {
            const style = el.getAttribute('style');
            if (style && style.includes('url(')) {
                const newStyle = style.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (match, url) => {
                    if (url.startsWith('/') && !url.startsWith('//')) {
                        return `url('${baseUrl}${url}')`;
                    }
                    return match;
                });
                el.setAttribute('style', newStyle);
            }
        });
        
        return tempDiv.innerHTML;
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
            // Create container for button and dropdown
            const container = document.createElement('div');
            container.id = 'uas-ext-container';
            Object.assign(container.style, {
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                zIndex: 99999
            });
            
            btn = document.createElement('button');
            btn.id = 'uas-ext-btn';
            btn.textContent = 'Send Article to Gmail ▼';
            Object.assign(btn.style, {
                padding: '8px 16px',
                background: '#348ceb',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                borderRadius: '6px',
                border: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'block',
                width: '100%'
            });
            
            // Create dropdown menu
            const menu = document.createElement('div');
            menu.id = 'uas-ext-menu';
            Object.assign(menu.style, {
                display: 'none',
                position: 'absolute',
                bottom: '45px',
                right: '0',
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '220px',
                overflow: 'hidden'
            });
            
            const option1 = document.createElement('div');
            option1.textContent = 'Send with full content';
            option1.className = 'uas-menu-option';
            Object.assign(option1.style, {
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                fontSize: '13px',
                transition: 'background 0.15s'
            });
            
            const option2 = document.createElement('div');
            option2.textContent = 'Send with URL only';
            option2.className = 'uas-menu-option';
            Object.assign(option2.style, {
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'background 0.15s'
            });
            
            // Hover effects
            [option1, option2].forEach(opt => {
                opt.addEventListener('mouseenter', () => opt.style.background = '#f5f5f5');
                opt.addEventListener('mouseleave', () => opt.style.background = '#fff');
            });
            
            menu.appendChild(option1);
            menu.appendChild(option2);
            container.appendChild(menu);
            container.appendChild(btn);
            
            container.appendChild(menu);
            container.appendChild(btn);
            
            // Toggle menu on button click
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', () => {
                menu.style.display = 'none';
            });
            
            // Handle option clicks
            const handleSend = (useUrlOnly) => {
                menu.style.display = 'none';
                const el = findArticleElement(config);
                if (!el) {
                    alert('Article not found!');
                    window.UAS_TRACE && UAS_TRACE.event('article_click_missing', {});
                    return;
                }
                const span = window.UAS_TRACE ? UAS_TRACE.startSpan('extract_and_store', { url: location.href, mode: useUrlOnly ? 'url-only' : 'full' }) : null;
                
                // Convert relative URLs to absolute
                const articleHtml = convertRelativeUrls(el.outerHTML);
                
                const fullHtml = `<h1>${document.title}</h1>
<p><strong>Source:</strong> <a href="${location.href}" target="_blank">${location.href}</a></p>
${articleHtml}`;
                const urlOnlyHtml = `<p><strong>Source:</strong> <a href="${location.href}" target="_blank">${location.href}</a></p>`;
                const htmlForGmail = useUrlOnly ? urlOnlyHtml : fullHtml;
                const htmlForClipboard = fullHtml; // Always copy full content

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
                        const plainText = htmlForClipboard.replace(/<[^>]+>/g,'');
                        const attemptClipboard = async () => {
                            let success = false;
                            const doHtml = !settings.clipboardPlainTextOnly;
                            try {
                                if (navigator.clipboard && window.ClipboardItem && doHtml) {
                                    const item = new ClipboardItem({
                                        'text/html': new Blob([htmlForClipboard], { type: 'text/html' }),
                                        'text/plain': new Blob([plainText], { type: 'text/plain' })
                                    });
                                    await navigator.clipboard.write([item]);
                                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_write_api_success', { bytes: htmlForClipboard.length, mode:'html+text' });
                                    success = true;
                                    window.UAS_TRACE && UAS_TRACE.endSpan(copySpan, { method: 'ClipboardItem' });
                                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                                    await navigator.clipboard.writeText(settings.clipboardPlainTextOnly ? plainText : htmlForClipboard);
                                    window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_write_text_success', { bytes: htmlForClipboard.length, mode: settings.clipboardPlainTextOnly?'text':'html' });
                                    success = true;
                                    window.UAS_TRACE && UAS_TRACE.endSpan(copySpan, { method: 'writeText' });
                                }
                            } catch (e) {
                                window.UAS_TRACE && UAS_TRACE.addEventToSpan(copySpan, 'clipboard_primary_failed', { error: e.message });
                            }
                            if (!success) {
                                try {
                                    const ta = document.createElement('textarea');
                                    ta.value = settings.clipboardPlainTextOnly ? plainText : htmlForClipboard;
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
                    
                    console.log('UAS: Saving article content to storage');
                    chrome.storage.local.set({
                        articleContentForGmail: htmlForGmail,
                        articleToEmail: config.defaultRecipient || config.toEmail || "",
                        articleSubject: document.title
                    }, () => {
                        console.log('UAS: Article content saved, opening Gmail');
                        window.UAS_TRACE && UAS_TRACE.addEventToSpan(span, 'stored_in_chrome_storage', { bytes: htmlForGmail.length });
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
                });
            };
            
            option1.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSend(false);
            });
            
            option2.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSend(true);
            });
            
            document.body.appendChild(container);
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