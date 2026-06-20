// Content script runs in the isolated world of the webpage
// Inject a script into the main world to access webpack and localStorage safely
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
(document.head || document.documentElement).appendChild(script);

let activeRequestId = null;
let pendingSendResponse = null;

// Listen for messages from the injected script
window.addEventListener("message", (event) => {
    // We only accept messages from ourselves, strictly checking origin
    if (event.source !== window || event.origin !== window.location.origin) return;
    
    if (event.data && event.data.type === "DISCORD_TOKEN_RESULT") {
        if (event.data.requestId === activeRequestId && pendingSendResponse) {
            if (event.data.data.success) {
                // Pass directly to popup, never storing it locally
                pendingSendResponse({ success: true, token: event.data.data.token });
            } else {
                pendingSendResponse({ error: "Failed to retrieve token.", success: false });
            }
            activeRequestId = null;
            pendingSendResponse = null;
        }
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getToken") {
        activeRequestId = crypto.randomUUID();
        pendingSendResponse = sendResponse;
        
        // Dispatch secure request to injected script
        window.postMessage({ 
            type: "DISCORD_TOKEN_REQUEST", 
            requestId: activeRequestId 
        }, window.location.origin);
        
        return true; // Keep the message channel open for async response
    }
});
