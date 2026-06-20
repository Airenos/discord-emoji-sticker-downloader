<p align="center">
  <img src="icons/logo.png" alt="DiscordKit Logo" width="128" height="128">
</p>

<h1 align="center">Discord Emoji & Sticker Downloader</h1>

<p align="center">
  [ <a href="#-english">English</a> | <a href="#-中文">中文</a> ]
</p>

<p align="center">
  A local-first userscript and browser extension for exporting custom Discord emojis and stickers from servers your current account can access.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/tampermonkey-supported-success" alt="Tampermonkey">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

---

## 🇺🇸 English

### ✨ Features
- 🎨 **Batch Export Emojis** — Export custom emojis from servers you have access to.
- 🎟️ **Batch Export Stickers** — Export stickers from your accessible servers.
- ✅ **Custom Selection** — Select exactly what you want to export.
- 📦 **ZIP Export** — Automatically packages your exports into a structured `.zip` file.
- 🔓 **Source-Available** — No project-side artificial paywalls.
- 🛠️ **Two Versions Available** — Choose between a Browser Extension or a Userscript.

### 📥 Option 1: Userscript (Tampermonkey/Greasemonkey) - *Recommended!*
This is the easiest way to use the tool, without dealing with Developer Mode warnings.
1. Install a Userscript manager like [Tampermonkey](https://www.tampermonkey.net/).
2. Click here to install the script: [Install `discord-downloader.user.js`](discord-downloader.user.js) *(If hosting on GreasyFork, link here)*.
3. Open [Discord Web](https://discord.com), and you will see a floating **"📥 Emojis"** button in the bottom right corner. Click it to start downloading!

### 🧩 Option 2: Browser Extension (Developer Mode)
1. Download this repository (`Code` -> `Download ZIP`) and extract it.
2. Go to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer Mode**.
4. Click **Load unpacked** and select the extracted folder.
5. Click the extension icon in your browser toolbar while on the Discord website.

---

## 🇨🇳 中文

### ✨ 功能特性
- 🎨 **批量导出表情** — 批量导出当前账号可访问服务器中的自定义表情。
- 🎟️ **批量导出贴纸** — 批量导出当前账号可访问服务器中的贴纸。
- ✅ **自定义选择** — 支持全选、反选或精准挑选你要导出的项目。
- 📦 **ZIP 打包导出** — 自动整理并打包成 `.zip` 文件下载到本地。
- 🔓 **开源透明** — 无内置项目方强制收费墙。
- 🛠️ **双版本支持** — 提供浏览器扩展和油猴脚本两种选择。

### 📥 方式一：油猴脚本 (Tampermonkey) - *强烈推荐！*
这是最方便的使用方式，无需忍受浏览器开发者模式的弹窗警告。
1. 安装 [Tampermonkey (油猴)](https://www.tampermonkey.net/) 扩展。
2. 点击此处安装脚本：[安装 `discord-downloader.user.js`](discord-downloader.user.js) *(如果在 GreasyFork 上架，请替换链接)*。
3. 打开 [Discord 网页版](https://discord.com)，你会看到右下角出现一个悬浮的 **"📥 Emojis"** 按钮，点击即可开始下载！

### 🧩 方式二：浏览器扩展 (开发者模式)
1. 下载本仓库源码（点击 `Code` -> `Download ZIP`）并解压。
2. 浏览器打开 `chrome://extensions/`（或 `edge://extensions/`）。
3. 开启右上角的 **开发者模式**。
4. 点击 **加载解压缩的扩展**，选择刚刚解压的目录。
5. 在 Discord 网页中点击右上角的扩展图标即可使用。

---

## 🛡️ Privacy & Security / 隐私与安全说明

### English
This tool runs locally in your browser. To request emoji and sticker metadata, it uses your current Discord Web session locally when calling Discord API endpoints.
This project code does not upload your Discord session token to the developer, analytics services, or third-party servers.
This is an unofficial tool and may not match Discord's intended API usage. Use it at your own risk.

### 中文
本工具在浏览器本地运行。为了获取服务器 Emoji / Sticker 元数据，脚本会在本地使用当前 Discord Web 会话认证信息请求 Discord API。
本项目代码不会将 Discord 会话认证信息上传给作者服务器、统计服务或第三方服务器。
本工具不是 Discord 官方工具，可能不符合 Discord 预期的 API 使用方式。请自行承担账号与平台规则风险。

## ⚠️ Platform Notice / 平台风险警告
Discord states that automating normal user accounts outside the OAuth2/bot API is forbidden and may result in account termination. This project is provided for local personal export use only.
Discord 官方支持页说明，普通用户账号自动化属于 OAuth2/bot API 之外的禁止行为，可能导致账号终止。请自行评估使用风险。

## ⚖️ Disclaimer / 免责声明
- This tool is intended for **personal backup/export use only**. (本工具仅供个人学习和备份导出使用)
- Please respect Discord's [Terms of Service](https://discord.com/terms). (请严格遵守 Discord 的服务条款)
- Do not use exported assets for unauthorized commercial purposes. (请勿将导出的资产用于未经授权的商业用途)

## 📄 License / 开源协议
This project is licensed under the [MIT License](LICENSE).
