let lastArticleContent = null;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SAVE_ARTICLE") {
        lastArticleContent = msg.payload;
        chrome.storage.local.set({ lastArticleContent });
        sendResponse({ status: "OK" });
    }
    if (msg.type === "GET_ARTICLE") {
        if (lastArticleContent) {
            sendResponse({ article: lastArticleContent });
        } else {
            chrome.storage.local.get("lastArticleContent", data => {
                sendResponse({ article: data.lastArticleContent });
            });
            return true;
        }
    }
});