# 🤖 Kaif-Md-V3 🤖
### Developed by [Kaif (ixxkaif)](https://github.com/ixxkaif) & [KaifxChaudhary-dev](https://github.com/KaifxChaudhary-dev)

[![Heroku Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/kaifxchaudhary14600/Kaif-Md-V5)

A powerful, light, and high-performance WhatsApp bot focused on **Auto-Forwarding**, **Session Security**, and **Core Utilities**.

---

## 🚀 **KEY FEATURES**

- 🔄 **Auto-Forwarding**: Automatically relay messages from source groups or chats to target groups/channels/newsletters seamlessly.
- 🧹 **Smart Cleaning & Sanitization**: Automatically strips "Forwarded" labels, forwarding scores, and cleans unwanted text/captions.
- ✍️ **Regex Replacements**: Custom text transformation on-the-fly (remove unwanted links, tags, or add custom footers).
- 💾 **Dual Session Persistence**: Supports **MongoDB** for cloud persistence and automatically falls back to **Local Multi-File Auth** if MongoDB is omitted.
- 🌐 **Web Dashboard & Control Panel**: Built-in web dashboard (Port `3000`) to view status, scan QR codes live, adjust settings, clean cache, and reset sessions.
- 🛡️ **Anti-Delete & Auto-Status**: Built-in utilities for capturing deleted messages and auto-viewing/reacting to status updates.
- ⚡ **Light & Fast**: Zero bloatware, built on Baileys for maximum speed, low resource usage, and 24/7 stability.

---

## 🛠️ **AVAILABLE COMMANDS**

| Command | Aliases | Category | Description |
| ------- | ------- | -------- | ----------- |
| `.af` | `.autoforward`, `.autofwd` | AutoForward | Configure auto-forwarding for specific groups or global targets |
| `.f` | `.forward` | Tools | Manually forward a replied message to one or multiple target JIDs |
| `.gjids` | `.gjid`, `.groups` | Tools | List all participating groups with member counts and unique JIDs |
| `.jid` | — | Debug | Get the exact JID of the current chat |
| `.antidelete` | `.anti-delete` | Settings | Toggle Anti-Delete to forward deleted messages to owner inbox |
| `.autostatus` | `.statusseen` | Settings | Toggle automatic WhatsApp status viewing and reactions |
| `.menu` | `.help`, `.h` | Information | Interactive menu showing all commands |
| `.ping` | — | Information | Check bot response latency |
| `.uptime` | — | Information | Display bot active uptime |

---

## 💻 **SETUP & DEPLOYMENT**

### **Prerequisites**
- **Node.js 20+**
- **MongoDB Database** (Optional — recommended for Heroku multi-tenant cloud storage, falls back to local storage)

### **Local Installation**

```bash
# 1. Clone the repository
git clone https://github.com/KaifxChaudhary-dev/Kaif-Md.git
cd Kaif-Md

# 2. Install dependencies
npm install

# 3. Start the bot
npm start
```

Once started, open `http://localhost:3000` in your web browser to view the Control Panel and scan the QR code.

---

## ⚙️ **ENVIRONMENT VARIABLES**

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `SESSION_ID` | Optional | Custom session identifier (defaults to `kaif_session`). |
| `MONGODB_URL` / `MONGODB_URI` | Optional | MongoDB connection string for cloud persistence. |
| `OLD_TEXT_REGEX` | Optional | Comma-separated patterns/words to strip/replace from forwarded messages. |
| `NEW_TEXT` | Optional | Replacement text to insert in place of matched regex. |
| `OWNER_NUMBER` | Optional | Personal WhatsApp number of the bot owner (e.g., `923453684061`). |
| `PORT` | Optional | Web dashboard server port (defaults to `3000`). |

---

## 🌐 **WEB CONTROL PANEL**
Access the built-in control panel at `http://localhost:3000` (or your Heroku app URL) to:
- 📸 **Scan QR Code**: Connect your WhatsApp account via Linked Devices.
- ⚙️ **Configure Settings**: Toggle Auto-Forwarding, Auto-Status, and Regex Cleaning live.
- 🧹 **Clean Cache**: Purge temporary files and clear expired message buffers.
- 🔄 **Reset Session**: Force session clear and generate a new QR code anytime.

---

## ❤️ **CREDITS & LICENSING**
- **Core Library**: [Whiskeysockets Baileys](https://github.com/WhiskeySockets/Baileys)
- **Developer**: [Kaif (ixxkaif)](https://github.com/ixxkaif) & [KaifxChaudhary-dev](https://github.com/KaifxChaudhary-dev)
- **Version**: 3.0.0 (Kaif-Md-V3)

---
> _Powered by Kaif-Md-V3_
