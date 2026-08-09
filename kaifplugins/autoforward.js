/**
 * ⚡ KAIF-MD-V3 ⚡
 * VIP Global Auto-Forward Plugin (Compact Sleek UI)
 * Developed by Kaif (ixxkaif)
 */
const { kaif_getGlobalAutoForward, kaif_updateGlobalAutoForward } = require('../kaiflib/database');

function sanitizeJid(input) {
    if (!input || typeof input !== 'string') return null;
    let str = input.trim().toLowerCase();

    const keywords = ['global', 'set', 'add', 'on', 'off', 'clear', 'source_jids', 'target_jids', 'sources', 'targets', 'source', 'target', 'src', 'tgt', 'dest', 'type', 'types', 'status'];
    if (keywords.includes(str)) return null;

    const parts = str.split(/\s+/);
    const lastPart = parts[parts.length - 1];
    if (lastPart.endsWith('@g.us') || lastPart.endsWith('@s.whatsapp.net') || lastPart.endsWith('@newsletter') || lastPart.endsWith('@lid')) {
        return lastPart;
    }

    const digits = str.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.length >= 15) {
        return digits + '@g.us';
    } else if (digits.length >= 7) {
        return digits + '@s.whatsapp.net';
    }
    return null;
}

function parseJids(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const items = rawText.split(/[\s,]+/);
    const validJids = [];
    for (const item of items) {
        const cleaned = sanitizeJid(item);
        if (cleaned) validJids.push(cleaned);
    }
    return [...new Set(validJids)];
}

module.exports = {
    name: 'autoforward',
    alias: ['af', 'globalaf', 'autofwd'],
    aliases: ['af', 'globalaf', 'autofwd'],
    desc: 'VIP Fast Global Auto-Forwarding Suite',
    category: 'owner',

    kaif_handler: async (sock, from, context) => {
        const { kaif_sender, kaif_msg, kaif_args, sessionId, kaif_isOwner, kaif_isSudo, kaif_isSuperOwner } = context;

        if (!kaif_isOwner && !kaif_isSudo && !kaif_isSuperOwner) {
            return await sock.sendMessage(from, { 
                text: '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n⛔ *Owner / Sudo permission required.*',
            }, { quoted: kaif_msg });
        }

        const args = kaif_args.map(a => a.trim().toLowerCase()).filter(Boolean);
        const action = args[0] || '';
        const subAction = args[1] || '';

        const globalCfg = (await kaif_getGlobalAutoForward(sessionId)) || {};

        if (action === 'on') {
            await kaif_updateGlobalAutoForward(sessionId, { enabled: true });
            return await sock.sendMessage(from, { 
                text: '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n🟢 *ACTIVE*  ⚡ *INSTANT DISPATCH*' 
            }, { quoted: kaif_msg });
        }

        if (action === 'off') {
            await kaif_updateGlobalAutoForward(sessionId, { enabled: false });
            return await sock.sendMessage(from, { 
                text: '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n🔴 *INACTIVE*  ⚡ *PAUSED*' 
            }, { quoted: kaif_msg });
        }

        if (action === 'clear') {
            await kaif_updateGlobalAutoForward(sessionId, { enabled: false, sourceJids: [], targetJids: [] });
            return await sock.sendMessage(from, { 
                text: '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n🧹 *CONFIG PURGED*' 
            }, { quoted: kaif_msg });
        }

        const isSourceKey = (k) => ['source', 'sources', 'src', 'source_jids'].includes(k);
        const isTargetKey = (k) => ['target', 'targets', 'tgt', 'dest', 'target_jids'].includes(k);

        if (action === 'set' || action === 'add') {
            const rawVal = kaif_args.slice(1).join(' ');
            const newJids = parseJids(rawVal);

            if (isSourceKey(subAction)) {
                const current = globalCfg.sourceJids || [];
                const updated = action === 'add' ? [...new Set([...current, ...newJids])] : newJids;
                await kaif_updateGlobalAutoForward(sessionId, { sourceJids: updated, enabled: true });
                
                let listStr = updated.length ? updated.map(j => '' + j + '').join('\n') : '🌐 *All Chats (Global)*';
                let text = '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n📥 *SOURCE*\n' + listStr + '\n\n🟢 *Active*';
                return await sock.sendMessage(from, { text }, { quoted: kaif_msg });
            }

            if (isTargetKey(subAction)) {
                const current = globalCfg.targetJids || [];
                const updated = action === 'add' ? [...new Set([...current, ...newJids])] : newJids;
                await kaif_updateGlobalAutoForward(sessionId, { targetJids: updated, enabled: true });
                
                let listStr = updated.length ? updated.map(j => '' + j + '').join('\n') : '⚠️ *No Targets Set*';
                let text = '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n📤 *TARGET*\n' + listStr + '\n\n🟢 *Active*';
                return await sock.sendMessage(from, { text }, { quoted: kaif_msg });
            }

            if (newJids.length > 0) {
                const current = globalCfg.targetJids || [];
                const updated = action === 'add' ? [...new Set([...current, ...newJids])] : newJids;
                await kaif_updateGlobalAutoForward(sessionId, { targetJids: updated, enabled: true });
                
                let listStr = updated.map(j => '' + j + '').join('\n');
                let text = '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n📤 *TARGET*\n' + listStr + '\n\n🟢 *Active*';
                return await sock.sendMessage(from, { text }, { quoted: kaif_msg });
            }
        }

        if (isSourceKey(action)) {
            const rawVal = kaif_args.slice(1).join(' ');
            const sources = parseJids(rawVal);
            await kaif_updateGlobalAutoForward(sessionId, { sourceJids: sources, enabled: true });
            
            let listStr = sources.length ? sources.map(j => '' + j + '').join('\n') : '🌐 *All Chats (Global)*';
            let text = '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n📥 *SOURCE*\n' + listStr + '\n\n🟢 *Active*';
            return await sock.sendMessage(from, { text }, { quoted: kaif_msg });
        }

        if (isTargetKey(action)) {
            const rawVal = kaif_args.slice(1).join(' ');
            const targets = parseJids(rawVal);
            await kaif_updateGlobalAutoForward(sessionId, { targetJids: targets, enabled: true });
            
            let listStr = targets.length ? targets.map(j => '' + j + '').join('\n') : '⚠️ *No Targets Set*';
            let text = '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n📤 *TARGET*\n' + listStr + '\n\n🟢 *Active*';
            return await sock.sendMessage(from, { text }, { quoted: kaif_msg });
        }

        if (action === 'type' || action === 'types') {
            const typeKey = subAction;
            const toggleState = (args[2] || '').toLowerCase();
            const enable = toggleState === 'on' || toggleState === 'true' || toggleState === '1';

            const typeMap = {
                picture: 'forwardPicture', image: 'forwardPicture', pic: 'forwardPicture',
                video: 'forwardVideo', vid: 'forwardVideo',
                audio: 'forwardAudio', music: 'forwardAudio',
                doc: 'forwardDocument', document: 'forwardDocument', file: 'forwardDocument',
                text: 'forwardText', msg: 'forwardText'
            };

            const dbField = typeMap[typeKey];
            if (!dbField) {
                return await sock.sendMessage(from, {
                    text: '💡 *Usage:* .af type [pic|vid|audio|doc|text] on/off'
                }, { quoted: kaif_msg });
            }

            const updateObj = { [dbField]: enable };
            if (dbField === 'forwardPicture') {
                updateObj.forwardImage = enable;
            }

            await kaif_updateGlobalAutoForward(sessionId, updateObj);
            return await sock.sendMessage(from, {
                text: '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n🎬 *MEDIA*  ' + typeKey.toUpperCase() + ' → ' + (enable ? '*ON*' : '*OFF*')
            }, { quoted: kaif_msg });
        }

        // COMPACT COMPACT VIP STATUS DASHBOARD (EXACT USER FORMAT)
        const isEnabled = !!globalCfg.enabled;
        const statusHeaderStr = isEnabled ? '🟢 *ACTIVE*  ⚡ *INSTANT DISPATCH*' : '🔴 *INACTIVE*  ⚡ *PAUSED*';
        const sources = globalCfg.sourceJids || [];
        const targets = globalCfg.targetJids || [];

        let sourceListStr = sources.length 
            ? sources.map(j => '' + j + '').join('\n')
            : '🌐 *All Chats (Global)*';

        let targetListStr = targets.length 
            ? targets.map(j => '' + j + '').join('\n')
            : '⚠️ *No Targets Set*';

        // Media Emojis Status
        let mediaIcons = [];
        if (globalCfg.forwardText !== false) mediaIcons.push('💬');
        if (globalCfg.forwardPicture !== false && globalCfg.forwardImage !== false) mediaIcons.push('🖼️');
        if (globalCfg.forwardVideo !== false) mediaIcons.push('🎥');
        if (globalCfg.forwardAudio !== false) mediaIcons.push('🎵');
        if (globalCfg.forwardDocument !== false) mediaIcons.push('📄');

        let mediaStr = mediaIcons.length > 0 ? mediaIcons.join(' ') + ' *ON*' : '🔴 *OFF*';

        let vipMenuText = 
            '👑 *KAIF-MD V3 • VIP FORWARDER*\n\n' +
            statusHeaderStr + '\n\n' +
            '📥 *SOURCE*\n' +
            sourceListStr + '\n\n' +
            '📤 *TARGET*\n' +
            targetListStr + '\n\n' +
            '🎬 *MEDIA*  ' + mediaStr + '\n\n' +
            '⚙️ .af on • .af off\n' +
            '.af source • .af target\n' +
            '.af type • .af clear\n\n' +
            '*⚡ VIP GLOBAL AUTOMATION*';

        return await sock.sendMessage(from, { text: vipMenuText }, { quoted: kaif_msg });
    }
};