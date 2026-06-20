// This script runs in the main world of the web page, allowing access to the original page's globals and webpack
window.addEventListener("message", (event) => {
    // Strictly validate the origin to ensure the request came from our content script
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== "DISCORD_TOKEN_REQUEST") return;

    const extractToken = () => {
        const cleanToken = (t) => t ? t.replace(/^"|"$/g, "") : null;
        
        // Method 1: Webpack (more robust)
        try {
            if (window.webpackChunkdiscord_app) {
                let token = null;
                window.webpackChunkdiscord_app.push([
                    [Symbol()], {}, (require) => {
                        for (const key in require.c) {
                            const module = require.c[key].exports;
                            if (module) {
                                if (module.default && typeof module.default.getToken === 'function') {
                                    token = module.default.getToken();
                                    if (token) break;
                                }
                                if (typeof module.getToken === 'function') {
                                    token = module.getToken();
                                    if (token) break;
                                }
                            }
                        }
                    }
                ]);
                window.webpackChunkdiscord_app.pop(); // Clean up
                if (token) return cleanToken(token);
            }
        } catch (err) {}

        // Method 2: LocalStorage fallback
        try {
            const token = localStorage.getItem("token");
            if (token) return cleanToken(token);
        } catch (err) {}

        return null;
    };

    const token = extractToken();
    const result = token ? { token, success: true } : { error: "No token found", success: false };
    
    // Send back to content.js securely
    window.postMessage({ 
        type: "DISCORD_TOKEN_RESULT", 
        requestId: event.data.requestId, 
        data: result 
    }, window.location.origin);
});
