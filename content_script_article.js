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
        if (!config) return;
        const el = findArticleElement(config);
        if (!el) return;

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
                    return;
                }
                const html = `<h1>${document.title}</h1>
<p><strong>Source:</strong> <a href="${location.href}" target="_blank">${location.href}</a></p>
${el.outerHTML}`;
                
                console.log('UAS: Saving article content to storage');
                chrome.storage.local.set({
                    articleContentForGmail: html,
                    articleToEmail: config.defaultRecipient || config.toEmail || "",
                    articleSubject: document.title
                }, () => {
                    console.log('UAS: Article content saved, opening Gmail');
                    // Small delay to ensure storage is saved
                    setTimeout(() => {
                        // Open specifically POPUP, not tab
                        window.open(
                            'https://mail.google.com/mail/?view=cm&fs=1',
                            'uas_gmail_popup',
                            'popup,width=900,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
                        );
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

    window.addEventListener('DOMContentLoaded', () => addButton());
    window.addEventListener('load', () => addButton(true));
    observeUrlAndDomChanges();

})();