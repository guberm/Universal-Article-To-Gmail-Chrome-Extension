let lastArticleContent = null;
const traceBuffer = [];
const MAX_TRACE = 500;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SAVE_ARTICLE") {
        lastArticleContent = msg.payload;
        chrome.storage.local.set({ lastArticleContent });
        sendResponse({ status: "OK" });
    } else if (msg.type === "GET_ARTICLE") {
        if (lastArticleContent) {
            sendResponse({ article: lastArticleContent });
        } else {
            chrome.storage.local.get("lastArticleContent", data => {
                sendResponse({ article: data.lastArticleContent });
            });
            return true;
        }
    } else if (msg.type === 'UAS_TRACE') {
        // Store trace payloads for optional future diagnostics
        if (msg.payload) {
            traceBuffer.push({ t: Date.now(), ...msg.payload });
            if (traceBuffer.length > MAX_TRACE) traceBuffer.splice(0, traceBuffer.length - MAX_TRACE);
        }
    } else if (msg.type === 'UAS_TRACE_GET') {
        sendResponse({ traces: traceBuffer.slice(-200) });
    }
});
