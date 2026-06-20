// Greasy Fork release build.
// Keep this file in sync with discord-downloader.user.js,
// but do not include @updateURL or @downloadURL here.
// ==UserScript==
// @name         Discord Emoji & Sticker Downloader
// @name:zh-CN   Discord 表情与贴纸下载器
// @namespace    https://github.com/
// @version      1.1.0
// @description  Batch export custom Discord emojis and stickers from servers you can access. Uses your local Discord Web session to request metadata from Discord API.
// @description:zh-CN  批量导出当前账号可访问的 Discord 服务器自定义表情和贴纸；脚本会在本地使用当前 Discord Web 会话请求 Discord API。
// @author       Airenos (https://github.com/Airenos)
// @license      MIT
// @match        https://discord.com/*
// @icon         https://raw.githubusercontent.com/Airenos/discord-emoji-sticker-downloader/main/icons/logo128.png
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/2.6.1/jszip.min.js
// @grant        GM_xmlhttpRequest
// @connect      discord.com
// @connect      cdn.discordapp.com
// @connect      media.discordapp.net
// @homepageURL  https://github.com/Airenos/discord-emoji-sticker-downloader
// @supportURL   https://github.com/Airenos/discord-emoji-sticker-downloader/issues
// ==/UserScript==

(function() {
    'use strict';

    const API_HOST = "https://discord.com/api/v10";
    let userToken = null;
    let currentEmojis = [];
    let currentStickers = [];

    // --- Token Extraction (Safe against Sandbox and Discord's Webpack hooks) ---
    function extractToken() {
        try {
            // Discord overrides the global localStorage to hide the 'token' key.
            // We bypass this by creating a fresh iframe and using its pristine localStorage object.
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            const token = iframe.contentWindow.localStorage.getItem('token');
            document.body.removeChild(iframe);
            
            if (token) {
                return token.replace(/^"|"$/g, "");
            }
        } catch(e) { 
            console.error("Iframe token extraction error:", e); 
        }
        return null;
    }

    // --- API & Utilities ---
    function fetchApi(endpoint) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `${API_HOST}${endpoint}`,
                headers: {
                    "Authorization": userToken,
                    "Content-Type": "application/json"
                },
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch(e) { reject(new Error("Invalid JSON parsed")); }
                    } else {
                        reject(new Error(`HTTP ${res.status}`));
                    }
                },
                onerror: () => reject(new Error("Network Error"))
            });
        });
    }

    // Try native fetch first (for instant browser cache hits), fallback to GM_xmlhttpRequest
    async function downloadImage(url) {
        try {
            const res = await fetch(url, { cache: "force-cache" });
            if (res.ok) return await res.arrayBuffer();
        } catch (e) {
            // Fetch failed (likely CORS or opaque response), falling back
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                responseType: "arraybuffer",
                onload: (res) => {
                    if (res.status === 200) resolve(res.response);
                    else reject(new Error("Failed to download image"));
                },
                onerror: reject
            });
        });
    }

    const getEmojiUrl = (id, animated) => `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?v=1`;
    const getStickerPreviewUrl = (id) => `https://media.discordapp.net/stickers/${id}.png?size=1024`;
    
    function getStickerAsset(sticker) {
        const id = sticker.id;
        const formatType = Number(sticker.format_type);
        switch (formatType) {
            case 1: return { url: `https://media.discordapp.net/stickers/${id}.png?size=1024`, ext: "png" };
            case 2: return { url: `https://media.discordapp.net/stickers/${id}.png?size=1024`, ext: "png" }; // APNG
            case 3: return { url: `https://discord.com/stickers/${id}.json`, ext: "json" }; // LOTTIE
            case 4: return { url: `https://media.discordapp.net/stickers/${id}.gif?size=1024`, ext: "gif" };
            default: return { url: `https://media.discordapp.net/stickers/${id}.png?size=1024`, ext: "png" };
        }
    }

    async function mapLimit(items, limit, worker) {
        const results = [];
        let index = 0;
        async function run() {
            while (index < items.length) {
                const currentIndex = index++;
                results[currentIndex] = await worker(items[currentIndex], currentIndex);
            }
        }
        const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
        await Promise.all(runners);
        return results;
    }

    function safeFilename(name, fallback = "Discord_Server") {
        return String(name || fallback)
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/[\u0000-\u001f]/g, "_")
            .replace(/[. ]+$/g, "")
            .slice(0, 120) || fallback;
    }

    // --- UI Creation (Using Shadow DOM to avoid CSS conflicts) ---
    function injectUI() {
        if (document.getElementById('discord-downloader-root')) return;

        const host = document.createElement('div');
        host.id = 'discord-downloader-root';
        host.style.position = 'fixed';
        host.style.bottom = '20px';
        host.style.right = '20px';
        host.style.zIndex = '999999';
        document.body.appendChild(host);

        const shadow = host.attachShadow({mode: 'open'});

        const style = document.createElement('style');
        style.textContent = `
            :host {
                --blurple: #5865F2; --blurple-hover: #4752C4;
                --bg-main: #313338; --bg-sec: #2B2D31; --bg-tert: #1E1F22;
                --text: #DBDEE1; --text-muted: #949BA4;
            }
            .floating-btn {
                background: var(--blurple); color: white; border: none;
                padding: 12px 20px; border-radius: 20px; font-weight: bold;
                cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                transition: transform 0.2s, background 0.2s;
                display: flex; align-items: center; gap: 8px; font-family: sans-serif;
            }
            .floating-btn:hover { background: var(--blurple-hover); transform: translateY(-2px); }
            
            .modal-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.2s;
            }
            .modal-overlay.open { opacity: 1; pointer-events: all; }
            
            .modal {
                background: var(--bg-main); width: 450px; max-height: 80vh;
                border-radius: 8px; display: flex; flex-direction: column;
                color: var(--text); font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                overflow: hidden;
            }
            .modal-header { padding: 16px; border-bottom: 1px solid var(--bg-tert); display: flex; justify-content: space-between; align-items: center;}
            .modal-header h2 { margin: 0; font-size: 16px; color: white;}
            .close-btn { background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; }
            .close-btn:hover { color: white; }
            
            .modal-body { padding: 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px;}
            
            select { background: var(--bg-tert); color: var(--text); padding: 10px; border: 1px solid var(--bg-tert); border-radius: 4px; width: 100%; outline: none; cursor: pointer;}
            select option { background: var(--bg-sec); color: var(--text); }
            
            .grid-title { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;}
            .grid-actions button { background: var(--bg-sec); color: var(--text); border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;}
            .grid-actions button:hover { background: var(--blurple); color: white; }
            
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap: 8px; background: var(--bg-sec); padding: 8px; border-radius: 8px; max-height: 200px; overflow-y: auto;}
            .grid-item { aspect-ratio: 1; background: var(--bg-tert); border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; border: 2px solid transparent;}
            .grid-item img { width: 75%; height: 75%; object-fit: contain;}
            .grid-item.selected { border-color: var(--blurple); background: rgba(88, 101, 242, 0.2); }
            .grid-item.selected::after { content: '✓'; position: absolute; top: -5px; right: -5px; background: var(--blurple); color: white; width: 14px; height: 14px; font-size: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center;}
            
            .modal-footer { padding: 16px; border-top: 1px solid var(--bg-tert); }
            .download-btn { width: 100%; background: var(--blurple); color: white; border: none; padding: 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px; transition: 0.2s;}
            .download-btn:hover { background: var(--blurple-hover); }
            .download-btn:disabled { opacity: 0.5; cursor: not-allowed; }

            /* Scrollbar */
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: var(--bg-tert); }
            ::-webkit-scrollbar-thumb { background: #1A1B1E; border-radius: 4px;}
            @keyframes spin { 100% { transform: rotate(360deg); } }
        `;
        shadow.appendChild(style);

        // UI Structure
        const container = document.createElement('div');
        container.innerHTML = `
            <button class="floating-btn">📥 Emojis</button>
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Discord Emoji Downloader</h2>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="custom-select-container" style="position:relative; user-select:none;">
                            <div id="custom-select-trigger" style="background:var(--bg-tert); border:1px solid var(--bg-tert); color:var(--text); padding:10px; border-radius:4px; display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <div id="custom-select-text" style="flex:1; display:flex; align-items:center; gap:8px; overflow:hidden;">
                                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">Loading servers...</span>
                                </div>
                                <span style="font-size:12px;">▼</span>
                            </div>
                            <div id="custom-select-options" style="position:fixed; max-height:250px; overflow-y:auto; background:var(--bg-sec); border:1px solid #1E1F22; border-radius:4px; display:none; z-index:999999; box-shadow:0 8px 16px rgba(0,0,0,0.5);"></div>
                        </div>
                        <div id="content-area" style="display: none;">
                            <div class="grid-title">
                                <span>Emojis (<span id="emoji-count">0/0</span>)</span>
                                <div class="grid-actions"><button id="em-all">All</button> <button id="em-none">None</button></div>
                            </div>
                            <div class="grid" id="emoji-grid"></div>

                            <div class="grid-title" style="margin-top: 16px;">
                                <span>Stickers (<span id="sticker-count">0/0</span>)</span>
                                <div class="grid-actions"><button id="st-all">All</button> <button id="st-none">None</button></div>
                            </div>
                            <div class="grid" id="sticker-grid"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="download-btn" id="dl-btn" disabled>Download 0 Items</button>
                    </div>
                </div>
            </div>
        `;
        shadow.appendChild(container);

        // Selectors
        const btnOpen = shadow.querySelector('.floating-btn');
        const overlay = shadow.querySelector('.modal-overlay');
        const btnClose = shadow.querySelector('.close-btn');
        const customTrigger = shadow.querySelector('#custom-select-trigger');
        const customText = shadow.querySelector('#custom-select-text');
        const customOptions = shadow.querySelector('#custom-select-options');
        let currentServerName = "Discord_Server";
        const contentArea = shadow.querySelector('#content-area');
        const emGrid = shadow.querySelector('#emoji-grid');
        const stGrid = shadow.querySelector('#sticker-grid');
        const dlBtn = shadow.querySelector('#dl-btn');

        // Drag Logic
        let isDragging = false;
        btnOpen.addEventListener('mousedown', (e) => {
            isDragging = false;
            const startX = e.clientX, startY = e.clientY;
            const rect = host.getBoundingClientRect();
            
            // Switch from right/bottom to left/top for predictable dragging
            host.style.right = 'auto';
            host.style.bottom = 'auto';
            host.style.left = rect.left + 'px';
            host.style.top = rect.top + 'px';

            const onMouseMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
                if (isDragging) {
                    const rawLeft = rect.left + dx;
                    const rawTop = rect.top + dy;
                    const maxLeft = window.innerWidth - host.offsetWidth;
                    const maxTop = window.innerHeight - host.offsetHeight;
                    const nextLeft = Math.max(0, Math.min(rawLeft, maxLeft));
                    const nextTop = Math.max(0, Math.min(rawTop, maxTop));
                    
                    host.style.left = `${nextLeft}px`;
                    host.style.top = `${nextTop}px`;
                }
            };
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Logic
        let hasLoadedServers = false;
        btnOpen.onclick = async (e) => {
            if (isDragging) {
                e.preventDefault();
                return;
            }
            overlay.classList.add('open');
            if (!hasLoadedServers) {
                customText.innerHTML = '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">Step 1: Extracting Token...</span>';
                await new Promise(resolve => setTimeout(resolve, 50));

                userToken = extractToken();
                if (!userToken) {
                    customText.innerHTML = '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">Error: Token not found! Try refreshing.</span>';
                    return;
                }
                
                customText.innerHTML = '<svg style="width:20px;height:20px;animation:spin 1s linear infinite;color:var(--blurple);flex-shrink:0;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"></circle></svg><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">Step 2: Fetching Servers...</span>';
                try {
                    const guilds = await fetchApi("/users/@me/guilds");
                    guilds.sort((a, b) => a.name.localeCompare(b.name));
                    
                    customText.innerHTML = '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">-- Choose a Server --</span>';
                    customOptions.innerHTML = '';
                    
                    const createOpt = (id, name, icon) => {
                        const opt = document.createElement('div');
                        opt.style.cssText = "display:flex; align-items:center; gap:8px; padding:8px; cursor:pointer; color:var(--text); transition:background 0.2s;";
                        opt.onmouseover = () => opt.style.background = 'var(--blurple)';
                        opt.onmouseout = () => opt.style.background = 'transparent';
                        
                        const iconHtml = icon ? `<img src="https://cdn.discordapp.com/icons/${id}/${icon}.png?size=64" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:24px;height:24px;border-radius:50%;background:var(--bg-tert);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">#</div>`;
                        opt.innerHTML = `${iconHtml}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${name}</span>`;
                        
                        opt.onclick = () => {
                            customText.innerHTML = opt.innerHTML;
                            customOptions.style.display = 'none';
                            currentServerName = name;
                            onServerChange(id);
                        };
                        return opt;
                    };
                    
                    guilds.forEach(g => {
                        customOptions.appendChild(createOpt(g.id, g.name, g.icon));
                    });
                    
                    customTrigger.onclick = () => {
                        const isOpen = customOptions.style.display === 'block';
                        if (!isOpen) {
                            const rect = customTrigger.getBoundingClientRect();
                            customOptions.style.top = (rect.bottom + 4) + 'px';
                            customOptions.style.left = rect.left + 'px';
                            customOptions.style.width = rect.width + 'px';
                            customOptions.style.display = 'block';
                        } else {
                            customOptions.style.display = 'none';
                        }
                    };
                    hasLoadedServers = true;
                } catch(err) { customText.textContent = `API Error: ${err.message}`; }
            }
        };

        btnClose.onclick = () => { overlay.classList.remove('open'); customOptions.style.display = 'none'; };
        overlay.onclick = (e) => { 
            if (e.target === overlay) { overlay.classList.remove('open'); customOptions.style.display = 'none'; }
        };
        
        container.addEventListener('click', (e) => {
            if (hasLoadedServers && !customTrigger.contains(e.target)) {
                customOptions.style.display = 'none';
            }
        });
        
        shadow.querySelector('.modal-body').addEventListener('scroll', () => {
            if (customOptions) customOptions.style.display = 'none';
        });

        const updateCounts = () => {
            const emSel = emGrid.querySelectorAll('.selected').length;
            const stSel = stGrid.querySelectorAll('.selected').length;
            shadow.querySelector('#emoji-count').textContent = `${emSel}/${currentEmojis.length}`;
            shadow.querySelector('#sticker-count').textContent = `${stSel}/${currentStickers.length}`;
            const total = emSel + stSel;
            dlBtn.textContent = `Download ${total} Items`;
            dlBtn.disabled = total === 0;
        };

        const renderItems = (grid, items, type) => {
            grid.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'grid-item selected';
                div.dataset.id = item.id;
                
                const img = document.createElement('img');
                img.src = type === 'emoji' ? getEmojiUrl(item.id, item.animated) : getStickerPreviewUrl(item.id);
                img.title = item.name || "";
                img.alt = item.name || "";
                div.appendChild(img);

                div.onclick = () => { div.classList.toggle('selected'); updateCounts(); };
                grid.appendChild(div);
            });
        };

        const onServerChange = async (guildId) => {
            if(!guildId) { contentArea.style.display = 'none'; return; }
            contentArea.style.display = 'block';
            customTrigger.style.pointerEvents = 'none';
            const originalHtml = customText.innerHTML;
            customText.innerHTML = `<svg style="width:20px;height:20px;animation:spin 1s linear infinite;color:var(--blurple);flex-shrink:0;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"></circle></svg><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">Loading items...</span>`;
            
            try {
                const data = await fetchApi(`/guilds/${guildId}`);
                // Deduplicate names
                const dedup = (arr) => {
                    const counts = {};
                    return (arr||[]).map(x => {
                        const c = counts[x.name] || 0; counts[x.name] = c + 1;
                        return c > 0 ? {...x, name: `${x.name}~${c}`} : x;
                    });
                };
                currentEmojis = dedup(data.emojis);
                currentStickers = dedup(data.stickers);
                renderItems(emGrid, currentEmojis, 'emoji');
                renderItems(stGrid, currentStickers, 'sticker');
                updateCounts();
            } catch (e) { alert("Error loading emojis: " + e.message); }
            
            customText.innerHTML = originalHtml;
            customTrigger.style.pointerEvents = 'auto';
        };

        const setAll = (grid, state) => {
            grid.querySelectorAll('.grid-item').forEach(el => el.classList.toggle('selected', state));
            updateCounts();
        };
        shadow.querySelector('#em-all').onclick = () => setAll(emGrid, true);
        shadow.querySelector('#em-none').onclick = () => setAll(emGrid, false);
        shadow.querySelector('#st-all').onclick = () => setAll(stGrid, true);
        shadow.querySelector('#st-none').onclick = () => setAll(stGrid, false);

        dlBtn.onclick = async () => {
            dlBtn.disabled = true;
            dlBtn.textContent = "Preparing...";
            
            try {
                const zip = new JSZip();
                const emFolder = zip.folder("Emojis");
                const stFolder = zip.folder("Stickers");

                const emSel = Array.from(emGrid.querySelectorAll('.selected')).map(el=>el.dataset.id);
                const stSel = Array.from(stGrid.querySelectorAll('.selected')).map(el=>el.dataset.id);

                const failedItems = [];
                let successCount = 0;
                
                const selectedEmojis = currentEmojis.filter(x => emSel.includes(x.id));
                const selectedStickers = currentStickers.filter(x => stSel.includes(x.id));
                const totalItems = selectedEmojis.length + selectedStickers.length;
                let processed = 0;

                const updateDlProgress = () => {
                    processed++;
                    dlBtn.textContent = `Downloading ${processed}/${totalItems}`;
                };

                await mapLimit(selectedEmojis, 6, async (em) => {
                    try {
                        const buffer = await downloadImage(getEmojiUrl(em.id, em.animated));
                        const baseName = safeFilename(em.name, em.id);
                        emFolder.file(`${baseName}.${em.animated?'gif':'png'}`, new Uint8Array(buffer));
                        successCount++;
                    } catch(e) {
                        failedItems.push({ name: em.name, id: em.id, error: e?.message || String(e) });
                        console.warn("[Discord Downloader] Failed to download emoji:", em, e);
                    }
                    updateDlProgress();
                });
                
                await mapLimit(selectedStickers, 6, async (st) => {
                    try {
                        const asset = getStickerAsset(st);
                        const buffer = await downloadImage(asset.url);
                        const baseName = safeFilename(st.name, st.id);
                        stFolder.file(`${baseName}.${asset.ext}`, new Uint8Array(buffer));
                        successCount++;
                    } catch(e) {
                        failedItems.push({ name: st.name, id: st.id, error: e?.message || String(e) });
                        console.warn("[Discord Downloader] Failed to download sticker:", st, e);
                    }
                    updateDlProgress();
                });

                dlBtn.textContent = "Zipping...";
                await new Promise(r => setTimeout(r, 50));
                
                const uint8 = zip.generate({ type: "uint8array", compression: "STORE" });
                
                const serverName = safeFilename(currentServerName);
                const blob = new Blob([uint8], { type: "application/zip" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `${serverName}_Assets.zip`;
                a.click(); URL.revokeObjectURL(url);
                
                if (failedItems.length > 0) {
                    dlBtn.textContent = `Done: ${successCount} OK, ${failedItems.length} failed`;
                } else {
                    dlBtn.textContent = `Done: ${successCount} OK`;
                }
                setTimeout(() => updateCounts(), 3000);
            } catch(e) {
                alert("Error loading server data: " + e.message);
            }
            customTrigger.style.pointerEvents = 'auto';
        };
    }

    // Try to inject UI periodically until document body exists
    const initInterval = setInterval(() => {
        if (document.body) {
            clearInterval(initInterval);
            injectUI();
        }
    }, 1000);

})();
