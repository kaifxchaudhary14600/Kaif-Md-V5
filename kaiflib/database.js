const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
const mongoose = require('mongoose');

// SCHEMAS
const kaif_toggleSchema = new mongoose.Schema({
    jid: { type: String, required: true },
    command: { type: String, required: true },
    isEnabled: { type: Boolean, default: true }
});

const kaif_userSettingsSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    autoStatusSeen: { type: Boolean, default: false },
    autoStatusReact: { type: Boolean, default: false },
    autoStatusMessage: { type: Boolean, default: false },
    autoTyping: { type: Boolean, default: false },
    autoRecording: { type: Boolean, default: false },
    autoViewOnce: { type: Boolean, default: false }
});

const kaif_autoReplySchema = new mongoose.Schema({
    trigger: { type: String, required: true },
    reply: { type: String, required: true }
});

const kaif_rankSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    role: { type: String, default: 'Novice' }
});

const kaif_sessionIndexSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

const kaif_bgmSchema = new mongoose.Schema({
    trigger: { type: String, required: true },
    audioUrl: { type: String, required: true },
    mimetype: { type: String, default: 'audio/mp4' }
});

const kaif_bgmConfigSchema = new mongoose.Schema({
    isEnabled: { type: Boolean, default: true }
});

const kaif_mentionSchema = new mongoose.Schema({
    type: { type: String, default: 'text' },
    content: { type: String, required: true },
    mimetype: { type: String }
});

const kaif_mentionConfigSchema = new mongoose.Schema({
    isEnabled: { type: Boolean, default: true }
});

const kaif_botConfigSchema = new mongoose.Schema({
    prefix: { type: String, default: '.' },
    menuImage: { type: String, default: '' },
    autoRead: { type: Boolean, default: false },
    autoRejectCall: { type: Boolean, default: false },
    autoWelcome: { type: Boolean, default: false },
    autoGoodbye: { type: Boolean, default: false },
    welcomeMessage: { type: String, default: '' },
    goodbyeMessage: { type: String, default: '' },
    ownerName: { type: String, default: 'Kaif' },
    ownerNumber: { type: String, default: '' },
    ownerJid: { type: String, default: '' },
    sudo: { type: [String], default: [] },
    autoStatusSeen: { type: Boolean, default: true },
    autoStatusReact: { type: Boolean, default: true },
    autoStatusSave: { type: Boolean, default: false },
    antiDelete: { type: Boolean, default: true }
});

const kaif_groupSettingsSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    antilink: { type: Boolean, default: false },
    antilinkMode: { type: String, default: 'delete' },
    antilinkWarnings: { type: Map, of: Number, default: {} },
    antilinkMaxWarnings: { type: Number, default: 3 },
    antilinkWhitelist: { type: [String], default: [] },
    antidelete: { type: Boolean, default: false },
    antideleteDestination: { type: String, default: 'group' },
    autoForward: { type: Boolean, default: false },
    autoForwardTargets: { type: [String], default: [] },
    autoForwardTimestamp: { type: Boolean, default: false },
    autoForwardCaption: { type: String, default: '' },
    autoForwardReplacements: { type: [{ pattern: String, replacement: String }], default: [] },
    welcome: { type: Boolean, default: false },
    goodbye: { type: Boolean, default: false }
});

const kaif_globalAutoForwardSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    sourceJids: { type: [String], default: [] },
    targetJids: { type: [String], default: [] },
    autoForwardTimestamp: { type: Boolean, default: false },
    forwardText: { type: Boolean, default: true },
    forwardImage: { type: Boolean, default: true },
    forwardVideo: { type: Boolean, default: true },
    forwardAudio: { type: Boolean, default: true },
    forwardDocument: { type: Boolean, default: true },
    forwardSticker: { type: Boolean, default: true },
    oldTextRegex: { type: [String], default: [] },
    newText: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

// Message Store Schema with 6-Hour Strict TTL Expiration (21600 seconds)
const kaif_messageStoreSchema = new mongoose.Schema({
    msgId: { type: String, required: true, unique: true },
    remoteJid: { type: String, required: true },
    sender: { type: String, required: true },
    body: { type: String, default: '' },
    fullMsgData: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, expires: 21600 }
});

let isConnected = false;

// ⚡ IN-MEMORY CACHES FOR 0MS INSTANT SPEED
const botConfigCache = new Map();
const globalForwardCache = new Map();
const groupSettingsCache = new Map();

function getModel(sessionId, type) {
    const prefix = sessionId || 'kaif_session';
    const collectionName = `${prefix}.${type.toLowerCase()}`;
    const modelName = `${prefix}_${type}`;

    if (mongoose.models[modelName]) return mongoose.models[modelName];

    switch (type) {
        case 'Toggle': return mongoose.model(modelName, kaif_toggleSchema, collectionName);
        case 'UserSettings': return mongoose.model(modelName, kaif_userSettingsSchema, collectionName);
        case 'AutoReply': return mongoose.model(modelName, kaif_autoReplySchema, collectionName);
        case 'SessionIndex': return mongoose.model(modelName, kaif_sessionIndexSchema, collectionName);
        case 'Bgm': return mongoose.model(modelName, kaif_bgmSchema, collectionName);
        case 'BgmConfig': return mongoose.model(modelName, kaif_bgmConfigSchema, collectionName);
        case 'Mention': return mongoose.model(modelName, kaif_mentionSchema, collectionName);
        case 'MentionConfig': return mongoose.model(modelName, kaif_mentionConfigSchema, collectionName);
        case 'BotConfig': return mongoose.model(modelName, kaif_botConfigSchema, collectionName);
        case 'GroupSettings': return mongoose.model(modelName, kaif_groupSettingsSchema, collectionName);
        case 'GlobalAutoForward': return mongoose.model(modelName, kaif_globalAutoForwardSchema, collectionName);
        case 'Rank': return mongoose.model(modelName, kaif_rankSchema, collectionName);
        case 'MessageStore': return mongoose.model(modelName, kaif_messageStoreSchema, collectionName);
        default: throw new Error(`Unknown model type: ${type}`);
    }
}

async function kaif_connectDatabase(mongoDbUrl) {
    if (!mongoDbUrl) return false;
    try {
        await mongoose.connect(mongoDbUrl);
        isConnected = true;
        console.log('✅ Kaif Bot: Connected to MongoDB successfully!');
        return true;
    } catch (e) {
        console.error('❌ MongoDB Connection Error:', e.message);
        return false;
    }
}

function kaif_isDbConnected() {
    return isConnected;
}

async function kaif_getBotConfig(sessionId) {
    if (botConfigCache.has(sessionId)) {
        return botConfigCache.get(sessionId);
    }
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'BotConfig');
        let config = await Model.findOne({});
        if (!config) {
            config = await Model.create({});
        }
        const plainObj = config.toObject();
        botConfigCache.set(sessionId, plainObj);
        return plainObj;
    } catch (e) {
        console.error('DB Error getBotConfig:', e);
        return null;
    }
}

async function kaif_updateBotConfig(sessionId, updates) {
    if (botConfigCache.has(sessionId)) {
        const current = botConfigCache.get(sessionId) || {};
        botConfigCache.set(sessionId, { ...current, ...updates });
    }
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'BotConfig');
        const updated = await Model.findOneAndUpdate({}, updates, { upsert: true, new: true });
        if (updated) botConfigCache.set(sessionId, updated.toObject());
        return true;
    } catch (e) {
        console.error('DB Error updateBotConfig:', e);
        return false;
    }
}

async function kaif_saveMessage(sessionId, msgData) {
    if (!isConnected || !msgData?.msgId) return false;
    try {
        const Model = getModel(sessionId, 'MessageStore');
        await Model.findOneAndUpdate(
            { msgId: msgData.msgId },
            msgData,
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        return false;
    }
}

async function kaif_getMessage(sessionId, msgId) {
    if (!isConnected || !msgId) return null;
    try {
        const Model = getModel(sessionId, 'MessageStore');
        const msg = await Model.findOne({ msgId });
        return msg;
    } catch (e) {
        return null;
    }
}

async function kaif_purgeOldMessages(sessionId, hours = 6) {
    if (!isConnected) return 0;
    try {
        const Model = getModel(sessionId, 'MessageStore');
        const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
        const result = await Model.deleteMany({ createdAt: { $lt: cutoff } });
        return result.deletedCount || 0;
    } catch (e) {
        console.error('DB Purge Old Messages Error:', e.message);
        return 0;
    }
}

async function kaif_getGroupSettings(sessionId, jid) {
    const cacheKey = `${sessionId}_${jid}`;
    if (groupSettingsCache.has(cacheKey)) {
        return groupSettingsCache.get(cacheKey);
    }
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'GroupSettings');
        let settings = await Model.findOne({ jid });
        if (!settings) {
            settings = await Model.create({ jid });
        }
        const plainObj = settings.toObject();
        groupSettingsCache.set(cacheKey, plainObj);
        return plainObj;
    } catch (e) {
        console.error('DB Error getGroupSettings:', e);
        return null;
    }
}

async function kaif_updateGroupSettings(sessionId, jid, updates) {
    const cacheKey = `${sessionId}_${jid}`;
    if (groupSettingsCache.has(cacheKey)) {
        const current = groupSettingsCache.get(cacheKey) || {};
        groupSettingsCache.set(cacheKey, { ...current, ...updates });
    }
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'GroupSettings');
        const updated = await Model.findOneAndUpdate({ jid }, updates, { upsert: true, new: true });
        if (updated) groupSettingsCache.set(cacheKey, updated.toObject());
        return true;
    } catch (e) {
        console.error('DB Error updateGroupSettings:', e);
        return false;
    }
}

async function kaif_getGlobalAutoForward(sessionId) {
    if (globalForwardCache.has(sessionId)) {
        return globalForwardCache.get(sessionId);
    }
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'GlobalAutoForward');
        let config = await Model.findOne({});
        if (!config) {
            config = await Model.create({ enabled: false, sourceJids: [], targetJids: [] });
        }
        const plainObj = config.toObject();
        globalForwardCache.set(sessionId, plainObj);
        return plainObj;
    } catch (e) {
        console.error('DB Error getGlobalAutoForward:', e);
        return null;
    }
}

async function kaif_updateGlobalAutoForward(sessionId, updates) {
    if (globalForwardCache.has(sessionId)) {
        const current = globalForwardCache.get(sessionId) || {};
        globalForwardCache.set(sessionId, { ...current, ...updates });
    }
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'GlobalAutoForward');
        const updated = await Model.findOneAndUpdate({}, updates, { upsert: true, new: true });
        if (updated) globalForwardCache.set(sessionId, updated.toObject());
        return true;
    } catch (e) {
        console.error('DB Error updateGlobalAutoForward:', e);
        return false;
    }
}

module.exports = {
    kaif_connectDatabase,
    kaif_isDbConnected,
    kaif_getBotConfig,
    kaif_updateBotConfig,
    kaif_saveMessage,
    kaif_getMessage,
    kaif_purgeOldMessages,
    kaif_getGroupSettings,
    kaif_updateGroupSettings,
    kaif_getGlobalAutoForward,
    kaif_updateGlobalAutoForward
};
