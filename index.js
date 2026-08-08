const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
/**
 * ⚡ KAIF-MD-V3 ⚡
 * Main Entry Point
 * Developed by Kaif (ixxkaif)
 */
require('dotenv').config();

// Filter out noisy libsignal decryption/Bad MAC console spam
const originalConsoleError = console.error;
console.error = function (...args) {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (
        msg.includes('Bad MAC') ||
        msg.includes('Closing session: SessionEntry') ||
        msg.includes('Failed to decrypt message') ||
        msg.includes('Decrypted message with closed session') ||
        msg.includes('Closing open session in favor of incoming prekey bundle')
    ) {
        return;
    }
    originalConsoleError.apply(console, args);
};

const {
    DisconnectReason,
    jidNormalizedUser,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');

const { kaif_connectSession, kaif_clearSession } = require('./kaiflib/session');
const {
    kaif_connectDatabase,
    kaif_getGroupSettings,
    kaif_isDbConnected,
    kaif_getGlobalAutoForward,
    kaif_updateGlobalAutoForward,
    kaif_getBotConfig,
    kaif_updateBotConfig,
    kaif_saveMessage,
    kaif_getMessage,
    kaif_purgeOldMessages
} = require('./kaiflib/database');
const config = require('./kaif');
const qrcode = require('qrcode');

const kaif_app = express();
const kaif_port = process.env.PORT || 3000;

// In-memory store for fast anti-delete tracking
const msgStore = new Map();

// Helper to prune in-memory message store entries older than 6 hours
function pruneInMemoryStore() {
    const sixHoursAgo = Date.now() - (1 * 60 * 60 * 1000);
    let prunedCount = 0;
    for (const [id, msgObj] of msgStore.entries()) {
        const timestamp = msgObj._receivedAt || (msgObj.messageTimestamp ? msgObj.messageTimestamp * 1000 : 0);
        if (timestamp && timestamp < sixHoursAgo) {
            msgStore.delete(id);
            prunedCount++;
        }
    }
    if (prunedCount > 0) {
        console.log(`🧹 RAM Pruner: Removed ${prunedCount} cached messages older than 6 hours.`);
    }
}

// -----------------------------------------------------------------------------
// PLUGIN LOADER
// -----------------------------------------------------------------------------
const kaif_plugins = new Map();

function kaif_loadPlugins() {
    const pluginDir = path.join(__dirname, 'kaifplugins');
    if (!fs.existsSync(pluginDir)) return;

    const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
        const filePath = path.join(pluginDir, file);
        if (fs.existsSync(filePath)) {
            try {
                const plugin = require(`./kaifplugins/${file}`);
                if (plugin.name) {
                    const name = plugin.name.toLowerCase();
                    kaif_plugins.set(name, plugin);
                    if (plugin.aliases && Array.isArray(plugin.aliases)) {
                        plugin.aliases.forEach(alias => kaif_plugins.set(alias.toLowerCase(), plugin));
                    }
                }
            } catch (e) {
                console.error(`Failed to load plugin ${file}:`, e.message);
            }
        }
    }
    console.log(`✅ Loaded ${kaif_plugins.size} core commands.`);
}

// -----------------------------------------------------------------------------
// TEXT REPLACEMENT & CLEANING CONFIG
// -----------------------------------------------------------------------------
const { processAndCleanMessage, cleanTempFiles } = require('./kaiflib/cleaner');

// -----------------------------------------------------------------------------
// SESSION STATE
// -----------------------------------------------------------------------------
const sessions = new Map();

// Middleware
kaif_app.use(express.json());
kaif_app.use(express.static(path.join(__dirname, 'public')));

// Keep-Alive Route
kaif_app.get('/ping', (req, res) => res.status(200).send('pong'));

// Dashboard APIs
kaif_app.get('/api/status', async (req, res) => {
    const sessionId = config.sessionId || 'kaif_session';
    const session = sessions.get(sessionId);
    res.json({
        sessionId: config.sessionId,
        connected: session?.isConnected || false,
        qr: session?.qr || null,
        dbConnected: kaif_isDbConnected()
    });
});

kaif_app.get('/api/config', async (req, res) => {
    try {
        const sessionId = config.sessionId || 'kaif_session';
        const botCfg = await kaif_getBotConfig(sessionId);
        const globalCfg = await kaif_getGlobalAutoForward(sessionId);
        res.json({
            antiDelete: botCfg ? botCfg.antiDelete !== false : true,
            autoStatusSeen: botCfg ? botCfg.autoStatusSeen !== false : true,
            autoStatusReact: botCfg ? botCfg.autoStatusReact !== false : true,
            autoForwardEnabled: globalCfg ? globalCfg.enabled !== false : false,
            forwardText: globalCfg ? globalCfg.forwardText !== false : true,
            forwardImage: globalCfg ? globalCfg.forwardImage !== false : true,
            forwardVideo: globalCfg ? globalCfg.forwardVideo !== false : true,
            forwardAudio: globalCfg ? globalCfg.forwardAudio !== false : true,
            forwardDocument: globalCfg ? globalCfg.forwardDocument !== false : true,
            forwardSticker: globalCfg ? globalCfg.forwardSticker !== false : true,
            sourceJids: globalCfg?.sourceJids || [],
            targetJids: globalCfg?.targetJids || [],
            oldTextRegex: globalCfg?.oldTextRegex || [],
            newText: globalCfg?.newText || ""
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

kaif_app.post('/api/config', async (req, res) => {
    try {
        const sessionId = config.sessionId || 'kaif_session';
        const {
            antiDelete,
            autoStatusSeen,
            autoStatusReact,
            autoForwardEnabled,
            forwardText,
            forwardImage,
            forwardVideo,
            forwardAudio,
            forwardDocument,
            forwardSticker,
            sourceJids,
            targetJids,
            oldTextRegex,
            newText
        } = req.body;

        await kaif_updateBotConfig(sessionId, {
            antiDelete: antiDelete ?? true,
            autoStatusSeen: autoStatusSeen ?? true,
            autoStatusReact: autoStatusReact ?? true
        });

        await kaif_updateGlobalAutoForward(sessionId, {
            enabled: autoForwardEnabled ?? false,
            forwardText: forwardText ?? true,
            forwardImage: forwardImage ?? true,
            forwardVideo: forwardVideo ?? true,
            forwardAudio: forwardAudio ?? true,
            forwardDocument: forwardDocument ?? true,
            forwardSticker: forwardSticker ?? true,
            sourceJids: Array.isArray(sourceJids) ? sourceJids : (sourceJids || '').split(',').map(s => s.trim()).filter(Boolean),
            targetJids: Array.isArray(targetJids) ? targetJids : (targetJids || '').split(',').map(t => t.trim()).filter(Boolean),
            oldTextRegex: Array.isArray(oldTextRegex) ? oldTextRegex : (oldTextRegex || '').split(',').map(r => r.trim()).filter(Boolean),
            newText: newText || ""
        });

        res.json({ success: true, message: 'Settings saved successfully!' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

kaif_app.post('/api/clean', async (req, res) => {
    try {
        const sessionId = config.sessionId || 'kaif_session';
        const result = cleanTempFiles(true);
        pruneInMemoryStore();
        const purgedCount = await kaif_purgeOldMessages(sessionId, 6);

        res.json({
            success: true,
            message: `Refreshed! Cleaned ${result.cleanedCount} temp files and purged ${purgedCount} messages older than 6 hours from database!`
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

kaif_app.post('/api/reset-session', async (req, res) => {
    try {
        const newSessionId = await resetAndStartNewSession();
        res.json({
            success: true,
            sessionId: newSessionId,
            message: `Session reset successfully! New session: ${newSessionId}. Please scan the new QR code.`
        });
    } catch (e) {
        console.error('Reset Session error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// -----------------------------------------------------------------------------
// SESSION MANAGEMENT
// -----------------------------------------------------------------------------
async function startSession(sessionId) {
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId);
        if (existing.isConnected && existing.sock) return;
        if (existing.sock) {
            try {
                existing.sock.ev.removeAllListeners('connection.update');
                existing.sock.end(undefined);
            } catch (e) {}
            sessions.delete(sessionId);
        }
    }

    console.log(`📡 Starting session: ${sessionId}`);
    const sessionState = { sock: null, isConnected: false, qr: null };
    sessions.set(sessionId, sessionState);

    const { kaif_sock, saveCreds } = await kaif_connectSession(false, sessionId);
    sessionState.sock = kaif_sock;

    console.log(`📡 [${sessionId}] Socket created, listening for events...`);

    kaif_sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                sessionState.qr = await qrcode.toDataURL(qr);
                console.log(`📸 New QR Code generated for [${sessionId}]`);
            } catch (e) {
                console.error('Failed to generate QR:', e.message);
            }
        }

        if (connection === 'close') {
            sessionState.isConnected = false;
            sessionState.qr = null;
            const statusCode = (lastDisconnect?.error instanceof Boom) ?
                lastDisconnect.error.output.statusCode : 500;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;

            console.log(`Session ${sessionId}: Connection closed, reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(() => startSession(sessionId), 3000);
            } else {
                sessions.delete(sessionId);
                await kaif_clearSession(sessionId);
            }
        } else if (connection === 'open') {
            sessionState.isConnected = true;
            sessionState.qr = null;
            console.log(`✅ ${sessionId}: Connected to WhatsApp`);
        }
    });

    kaif_sock.ev.on('creds.update', saveCreds);

    // -------------------------------------------------------------------------
    // BATCH MESSAGE HANDLER (Optimized 0ms response speed)
    // -------------------------------------------------------------------------
    kaif_sock.ev.on('messages.upsert', async kaif_m => {
        if (!kaif_m.messages || !Array.isArray(kaif_m.messages)) return;

        for (const kaif_msg of kaif_m.messages) {
            if (!kaif_msg || !kaif_msg.message) continue;

            const kaif_origin = kaif_msg.key.remoteJid;
            const kaif_sender = jidNormalizedUser(kaif_msg.key.participant || kaif_origin);

            // 1. Super Owner & Sender Identification (with LID Resolution)
            const superOwners = (config.superOwners || ['923298634113', '923453684061', '923466859436']);
            const superCores = superOwners.map(n => n.replace(/\D/g, '').slice(-9)).filter(c => c.length >= 7);

            let realPhoneJid = kaif_sender;
            if (kaif_origin.endsWith('@g.us')) {
                try {
                    const gMeta = await kaif_sock.groupMetadata(kaif_origin).catch(() => null);
                    if (gMeta && gMeta.participants) {
                        const p = gMeta.participants.find(x => x.id === kaif_sender || x.lid === kaif_sender || x.id === kaif_msg.key?.participant || x.lid === kaif_msg.key?.participant);
                        if (p && p.id) realPhoneJid = p.id;
                    }
                } catch (e) {}
            }

            let keyStr = '';
            try { keyStr = JSON.stringify(kaif_msg.key || {}); } catch(e) {}

            const rawSenderData = [
                kaif_origin,
                kaif_sender,
                realPhoneJid,
                kaif_msg.key?.participant,
                kaif_msg.pushName,
                keyStr
            ].filter(Boolean).join(' ');

            const senderClean = (realPhoneJid || kaif_sender || '').replace(/\D/g, '');
            const isSuperOwner = superCores.some(core => rawSenderData.includes(core));

            // Diagnostic Logger
            if (!kaif_msg.key.fromMe) {
                console.log(`[MSG-TRACE] type:${kaif_m.type} origin:${kaif_origin} sender:${kaif_sender} isSuper:${isSuperOwner}`);
            }

            // 2. Auto Crown Reaction (ONLY LIVE NOTIFY MESSAGES FROM SUPER OWNERS)
            if ((!kaif_m.type || kaif_m.type === 'notify') && isSuperOwner) {
                try {
                    await kaif_sock.sendMessage(kaif_origin, {
                        react: { text: '\u{1F451}', key: kaif_msg.key }
                    });
                    console.log(`[SUPER-OWNER-REACT] Reacted with 👑 to super owner message from ${kaif_sender}`);
                } catch (e) {
                    console.error('[SUPER-OWNER-REACT] Error:', e.message);
                }
            }

            const kaif_text = kaif_msg.message.conversation ||
                kaif_msg.message.extendedTextMessage?.text ||
                kaif_msg.message.imageMessage?.caption ||
                kaif_msg.message.videoMessage?.caption ||
                kaif_msg.message.documentMessage?.caption || "";

            // Save message asynchronously without blocking the execution chain
            if (kaif_msg.key?.id) {
                kaif_msg._receivedAt = Date.now();
                msgStore.set(kaif_msg.key.id, kaif_msg);
                if (msgStore.size > 500) {
                    const firstKey = msgStore.keys().next().value;
                    msgStore.delete(firstKey);
                }

                // Asynchronous MongoDB write (non-blocking)
                kaif_saveMessage(sessionId, {
                    msgId: kaif_msg.key.id,
                    remoteJid: kaif_origin,
                    sender: kaif_sender,
                    body: kaif_text,
                    fullMsgData: kaif_msg
                }).catch(() => {});
            }

            // 0. AUTO STATUS SEEN & REACT
            if (kaif_origin === 'status@broadcast') {
                try {
                    const botCfg = await kaif_getBotConfig(sessionId);
                    if (botCfg ? botCfg.autoStatusSeen !== false : true) {
                        await kaif_sock.readMessages([kaif_msg.key]);
                    }
                    if (botCfg ? botCfg.autoStatusReact !== false : true) {
                        await kaif_sock.sendMessage('status@broadcast', {
                            react: { text: '❤️', key: kaif_msg.key }
                        }, { statusJidList: [kaif_msg.key.participant] });
                    }
                } catch (e) {}
                continue;
            }

            // 0.5 ANTI-DELETE DETECTION
            if (kaif_msg.message?.protocolMessage?.type === 0) {
                try {
                    const botCfg = await kaif_getBotConfig(sessionId);
                    if (botCfg ? botCfg.antiDelete !== false : true) {
                        const deletedId = kaif_msg.message.protocolMessage.key.id;
                        let deletedSender = null;
                        let body = null;
                        let originJid = kaif_origin;

                        const ramMsg = msgStore.get(deletedId);
                        if (ramMsg) {
                            deletedSender = ramMsg.key.participant || ramMsg.key.remoteJid;
                            body = ramMsg.message?.conversation ||
                                ramMsg.message?.extendedTextMessage?.text ||
                                ramMsg.message?.imageMessage?.caption ||
                                ramMsg.message?.videoMessage?.caption ||
                                ramMsg.message?.documentMessage?.caption ||
                                "[Media/Attachment]";
                        } else {
                            const dbMsg = await kaif_getMessage(sessionId, deletedId);
                            if (dbMsg) {
                                deletedSender = dbMsg.sender;
                                originJid = dbMsg.remoteJid;
                                body = dbMsg.body || "[Media/Attachment]";
                            }
                        }

                        if (deletedSender && body) {
                            const isGroup = originJid.endsWith('@g.us');
                            let originName = "Private Inbox";
                            if (isGroup) {
                                try {
                                    const meta = await kaif_sock.groupMetadata(originJid);
                                    originName = meta.subject || originJid;
                                } catch (e) {
                                    originName = originJid;
                                }
                            }

                            const ownerNum = (config.ownerNumber || '').replace(/\D/g, '');
                            const ownerJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : jidNormalizedUser(kaif_sock.user?.id || '');

                            const notificationText = `⚠️ *ANTI-DELETE NOTIFICATION*\n\n` +
                                `📍 *Source:* ${originName}\n` +
                                `👤 *Sender:* @${deletedSender.split('@')[0]}\n` +
                                `💬 *Deleted Message:*\n${body}`;

                            if (ownerJid) {
                                await kaif_sock.sendMessage(ownerJid, {
                                    text: notificationText,
                                    mentions: [deletedSender]
                                });
                            }
                        }
                    }
                } catch (e) {}
            }
            
            // 1. GLOBAL AUTO FORWARD LOGIC (High speed RAM cache & media filtering)
            if (kaif_origin.endsWith('@g.us') && !kaif_msg.key.fromMe) {
                try {
                    const globalCfg = await kaif_getGlobalAutoForward(sessionId);
                    if (globalCfg?.enabled && globalCfg.sourceJids?.includes(kaif_origin) && globalCfg.targetJids?.length > 0) {

                        // Media Type Filtering
                        const msgObj = kaif_msg.message || {};
                        const isText = !!(msgObj.conversation || msgObj.extendedTextMessage);
                        const isImage = !!msgObj.imageMessage;
                        const isVideo = !!msgObj.videoMessage;
                        const isAudio = !!msgObj.audioMessage;
                        const isDocument = !!msgObj.documentMessage;
                        const isSticker = !!msgObj.stickerMessage;

                        if (isText && globalCfg.forwardText === false) continue;
                        if (isImage && globalCfg.forwardImage === false) continue;
                        if (isVideo && globalCfg.forwardVideo === false) continue;
                        if (isAudio && globalCfg.forwardAudio === false) continue;
                        if (isDocument && globalCfg.forwardDocument === false) continue;
                        if (isSticker && globalCfg.forwardSticker === false) continue;

                        let customRegexList = [];
                        if (globalCfg.oldTextRegex && Array.isArray(globalCfg.oldTextRegex)) {
                            customRegexList = globalCfg.oldTextRegex.map(pattern => {
                                try {
                                    if (!pattern.trim()) return null;
                                    const escaped = pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    return new RegExp(escaped, 'gu');
                                } catch (e) { return null; }
                            }).filter(Boolean);
                        }

                        let relayMsg = processAndCleanMessage(kaif_msg.message, customRegexList, globalCfg.newText || "");

                        if (globalCfg.autoForwardTimestamp) {
                            const timeStr = `\n\n_[${new Date().toLocaleTimeString()}]_`;
                            if (relayMsg.conversation) relayMsg.conversation += timeStr;
                            else if (relayMsg.extendedTextMessage?.text) relayMsg.extendedTextMessage.text += timeStr;
                            else if (relayMsg.imageMessage) relayMsg.imageMessage.caption = (relayMsg.imageMessage.caption || "") + timeStr;
                            else if (relayMsg.videoMessage) relayMsg.videoMessage.caption = (relayMsg.videoMessage.caption || "") + timeStr;
                            else if (relayMsg.documentMessage) relayMsg.documentMessage.caption = (relayMsg.documentMessage.caption || "") + timeStr;
                        }

                        for (const targetJid of globalCfg.targetJids) {
                            try {
                                await kaif_sock.relayMessage(targetJid, relayMsg, {
                                    messageId: kaif_sock.generateMessageTag()
                                });
                                await new Promise(r => setTimeout(r, 50));
                            } catch (err) {
                                console.error(`[GLOBAL-FORWARD] Failed for ${targetJid}:`, err.message);
                            }
                        }
                    }
                } catch (err) {
                    console.error('[GLOBAL-FORWARD] Error:', err.message);
                }
            }



            // 3. COMMAND HANDLER
            const prefix = '.'; 
            if (kaif_text.trim().startsWith(prefix)) {
                const kaif_parts = kaif_text.trim().slice(prefix.length).trim().split(/\s+/);
                const kaif_cmd_input = kaif_parts[0].toLowerCase();
                const kaif_args = kaif_parts.slice(1);

                if (kaif_plugins.has(kaif_cmd_input)) {
                    const plugin = kaif_plugins.get(kaif_cmd_input);
                    try {
                        const isGroup = kaif_origin.endsWith('@g.us');
                        let kaif_isAdmin = false;
                        if (isGroup) {
                            try {
                                const groupMetadata = await kaif_sock.groupMetadata(kaif_origin).catch(() => null);
                                if (groupMetadata && groupMetadata.participants) {
                                    const senderMod = groupMetadata.participants.find(p => jidNormalizedUser(p.id) === kaif_sender || p.id === realPhoneJid);
                                    kaif_isAdmin = (senderMod?.admin === 'admin' || senderMod?.admin === 'superadmin');
                                }
                            } catch (e) { }
                        }

                        const ownerNum = (config.ownerNumber || '').replace(/\D/g, '');
                        const ownerCore = ownerNum.slice(-9);
                        const isOwner = kaif_msg.key.fromMe || isSuperOwner || (ownerCore && senderClean.includes(ownerCore));

                        await plugin.kaif_handler(kaif_sock, kaif_origin, {
                            kaif_sender,
                            kaif_msg,
                            kaif_args,
                            sessionId,
                            kaif_text,
                            kaif_isGroup: isGroup,
                            kaif_isAdmin,
                            kaif_isOwner: isOwner,
                            kaif_isSudo: isOwner,
                            kaif_plugins
                        });
                    } catch (err) {
                        console.error(`Error in plugin ${kaif_cmd_input}:`, err.message);
                    }
                }
            }
        }
    });
}

// Reset session and advance to next pattern session ID
async function resetAndStartNewSession() {
    const oldSessionId = config.sessionId || 'kaif_session';

    if (sessions.has(oldSessionId)) {
        const existing = sessions.get(oldSessionId);
        if (existing && existing.sock) {
            try {
                existing.sock.ev.removeAllListeners('connection.update');
                existing.sock.end(undefined);
            } catch (e) {}
        }
        sessions.delete(oldSessionId);
    }

    try {
        await kaif_clearSession(oldSessionId);
    } catch (e) {
        console.error('Clear MongoDB session error:', e.message);
    }

    const sessionIdFile = path.join(__dirname, '.session_id');
    if (fs.existsSync(sessionIdFile)) {
        try { fs.unlinkSync(sessionIdFile); } catch (e) {}
    }

    delete require.cache[require.resolve('./kaif')];
    const freshConfig = require('./kaif');
    config.sessionId = freshConfig.sessionId;

    console.log(`🔄 Session Reset: Advancing to new session ID: ${config.sessionId}`);

    await startSession(config.sessionId);
    return config.sessionId;
}

// -----------------------------------------------------------------------------
// MAIN STARTUP
// -----------------------------------------------------------------------------
async function main() {
    // 1. Start Dashboard Server IMMEDIATELY
    kaif_app.listen(kaif_port, () => {
        console.log(`🌐 Dashboard running on port ${kaif_port}`);
    });

    // 2. Load Core Commands
    kaif_loadPlugins();

    // 3. Schedule Automatic 6-Hour Memory Refresh & Cleanup
    cleanTempFiles(true);
    pruneInMemoryStore();

    // Background job running every 6 hours
    setInterval(async () => {
        const activeSessionId = config.sessionId || 'kaif_session';
        cleanTempFiles(true);
        pruneInMemoryStore();
        const purgedCount = await kaif_purgeOldMessages(activeSessionId, 6);
        if (purgedCount > 0) {
            console.log(`🧹 6-Hour Auto-Refresh: Purged ${purgedCount} expired messages from MongoDB.`);
        }
    }, 6 * 60 * 60 * 1000);

    // 4. Initialize Bot in Background
    (async () => {
        try {
            // Connect Database
            if (config.mongoDbUrl) {
                const dbResult = await kaif_connectDatabase(config.mongoDbUrl);
                if (dbResult) console.log('✅ Database connected');
            }

            // Start default session
            const sessionId = config.sessionId || 'kaif_session';
            await startSession(sessionId);
        } catch (err) {
            console.error('❌ Initialization Error:', err);
        }
    })();
}

main();
