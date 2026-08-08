// Filter out noisy libsignal log spam from console.info
if (!global.__kaif_console_info_patched) {
    global.__kaif_console_info_patched = true;
    const originalInfo = console.info;
    console.info = function (...args) {
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        if (
            msg.includes('Closing session:') ||
            msg.includes('Opening session:') ||
            msg.includes('SessionEntry {') ||
            msg.includes('registrationId:') ||
            msg.includes('ephemeralKeyPair:') ||
            msg.includes('pendingPreKey:')
        ) {
            return;
        }
        originalInfo.apply(console, args);
    };
}
const {
    fetchLatestWaWebVersion,
    makeCacheableSignalKeyStore,
    makeWASocket,
    Browsers,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('../kaif');
const { useMongoDBAuthState } = require('./mongoAuth');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

async function kaif_connectSession(usePairingCode = false, customSessionId = null) {
    const sessionId = customSessionId || config.sessionId || 'kaif_session';
    console.log(`🔌 Connecting to session: ${sessionId}`);

    let state, saveCreds;

    // Use MongoDB auth state if MongoDB is connected; otherwise fallback to local multi-file auth state
    if (config.mongoDbUrl && mongoose.connection.readyState === 1) {
        console.log(`💾 Using MongoDB session storage for: ${sessionId}`);
        const auth = await useMongoDBAuthState(sessionId);
        state = auth.state;
        saveCreds = auth.saveCreds;
    } else {
        console.log(`📁 Using local multi-file session storage for: ${sessionId}`);
        const sessionPath = path.join(process.cwd(), sessionId);
        const auth = await useMultiFileAuthState(sessionPath);
        state = auth.state;
        saveCreds = auth.saveCreds;
    }

    let version;
    try {
        const v = await fetchLatestWaWebVersion();
        version = v.version;
    } catch (e) {
        version = [2, 3000, 1017531287];
    }

    const socketOptions = {
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 25000,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
    };

    const kaif_sock = makeWASocket(socketOptions);

    return { kaif_sock, saveCreds };
}

async function kaif_clearSession(customSessionId = null) {
    const sessionId = customSessionId || config.sessionId || 'kaif_session';

    if (mongoose.connection.readyState === 1) {
        try {
            const { useMongoDBAuthState } = require('./mongoAuth');
            const { clearState } = await useMongoDBAuthState(sessionId);
            if (clearState) {
                await clearState();
                console.log(`🗑️ Session cleared from MongoDB: ${sessionId}`);
            }
        } catch (e) {
            console.error(`MongoDB clearState error: ${e.message}`);
        }
    }

    const sessionPath = path.join(process.cwd(), sessionId);
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`🗑️ Local session directory cleared: ${sessionPath}`);
        } catch (err) {
            console.error(`Error deleting local session folder: ${err.message}`);
        }
    }
}

module.exports = { kaif_connectSession, kaif_clearSession };
