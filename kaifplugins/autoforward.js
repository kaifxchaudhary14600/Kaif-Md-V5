/**
 * 🤖 KAIF-MD-V3 🤖
 * Global Auto Forward Manager
 * Developed by Kaif (ixxkaif)
 */
const { 
    kaif_getGlobalAutoForward,
    kaif_updateGlobalAutoForward
} = require('../kaiflib/database');

function parseJids(input) {
    if (!input) return [];
    return input
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => (s.includes('@') ? s : `${s}@g.us`));
}

module.exports = {
    name: 'autoforward',
    aliases: ['af', 'afglobal', 'autofwd'],
    category: 'AutoForward',
    desc: 'Configure Global Auto-Forwarding and media filters',
    kaif_handler: async (sock, from, context) => {
        const { kaif_msg, kaif_args, kaif_isOwner, kaif_isSudo, sessionId } = context;

        if (!kaif_isOwner && !kaif_isSudo) {
            return await sock.sendMessage(from, { text: '⛔ Owner/Sudo only.' }, { quoted: kaif_msg });
        }

        const action = (kaif_args[0] || '').toLowerCase();
        const subAction = (kaif_args[1] || '').toLowerCase();
        const globalCfg = (await kaif_getGlobalAutoForward(sessionId)) || {};

        if (action === 'on') {
            await kaif_updateGlobalAutoForward(sessionId, { enabled: true });
            return await sock.sendMessage(from, { text: '🚀 *Global Auto-Forward* enabled.' }, { quoted: kaif_msg });
        }

        if (action === 'off') {
            await kaif_updateGlobalAutoForward(sessionId, { enabled: false });
            return await sock.sendMessage(from, { text: '🔴 *Global Auto-Forward* disabled.' }, { quoted: kaif_msg });
        }

        // Media Type Toggles: .af media <text|image|video|audio|doc|sticker> <on|off>
        if (action === 'media') {
            const mediaType = subAction;
            const val = (kaif_args[2] || '').toLowerCase();
            const enableState = val === 'on' || val === 'true' || val === '1';

            let updateObj = {};
            if (mediaType === 'text') updateObj.forwardText = enableState;
            else if (mediaType === 'image' || mediaType === 'picture') updateObj.forwardImage = enableState;
            else if (mediaType === 'video') updateObj.forwardVideo = enableState;
            else if (mediaType === 'audio' || mediaType === 'voice') updateObj.forwardAudio = enableState;
            else if (mediaType === 'doc' || mediaType === 'document') updateObj.forwardDocument = enableState;
            else if (mediaType === 'sticker') updateObj.forwardSticker = enableState;
            else {
                return await sock.sendMessage(from, { 
                    text: '⚠️ Usage:\n`.af media text on/off`\n`.af media image on/off`\n`.af media video on/off`\n`.af media audio on/off`\n`.af media doc on/off`\n`.af media sticker on/off`' 
                }, { quoted: kaif_msg });
            }

            await kaif_updateGlobalAutoForward(sessionId, updateObj);
            return await sock.sendMessage(from, { 
                text: `✅ Forwarding for *${mediaType.toUpperCase()}* is now *${enableState ? 'ENABLED' : 'DISABLED'}*.` 
            }, { quoted: kaif_msg });
        }

        if (action === 'set') {
            const settingKey = subAction;
            const rawVal = kaif_args.slice(2).join(' ');

            if (settingKey === 'source_jids' || settingKey === 'sources') {
                const sources = parseJids(rawVal);
                await kaif_updateGlobalAutoForward(sessionId, { sourceJids: sources });
                return await sock.sendMessage(from, { text: `✅ Global source JIDs updated (${sources.length} JIDs).` }, { quoted: kaif_msg });
            }

            if (settingKey === 'target_jids' || settingKey === 'targets') {
                const targets = parseJids(rawVal);
                await kaif_updateGlobalAutoForward(sessionId, { targetJids: targets });
                return await sock.sendMessage(from, { text: `✅ Global target JIDs updated (${targets.length} JIDs).` }, { quoted: kaif_msg });
            }

            return await sock.sendMessage(from, { 
                text: '⚠️ Usage:\n`.af set source_jids jid1, jid2`\n`.af set target_jids jid1, jid2`' 
            }, { quoted: kaif_msg });
        }

        if (action === 'clear') {
            await kaif_updateGlobalAutoForward(sessionId, {
                enabled: false,
                sourceJids: [],
                targetJids: []
            });
            return await sock.sendMessage(from, { text: '🗑️ All Global Auto-Forward settings cleared.' }, { quoted: kaif_msg });
        }

        // Default Info Card
        let text = `🚀 *GLOBAL AUTO-FORWARD MANAGER*\n\n`;
        text += `• *Status:* ${globalCfg.enabled ? '🟢 ON' : '🔴 OFF'}\n`;
        text += `• *Sources (${globalCfg.sourceJids?.length || 0}):* ${globalCfg.sourceJids?.join(', ') || 'None'}\n`;
        text += `• *Targets (${globalCfg.targetJids?.length || 0}):* ${globalCfg.targetJids?.join(', ') || 'None'}\n\n`;
        text += `⚙️ *ALLOWED MEDIA TYPES*\n`;
        text += `• 📝 Text: ${globalCfg.forwardText !== false ? '✅' : '❌'}\n`;
        text += `• 🖼️ Images: ${globalCfg.forwardImage !== false ? '✅' : '❌'}\n`;
        text += `• 🎥 Videos: ${globalCfg.forwardVideo !== false ? '✅' : '❌'}\n`;
        text += `• 🎵 Audio/Voice: ${globalCfg.forwardAudio !== false ? '✅' : '❌'}\n`;
        text += `• 📄 Documents: ${globalCfg.forwardDocument !== false ? '✅' : '❌'}\n`;
        text += `• 🎨 Stickers: ${globalCfg.forwardSticker !== false ? '✅' : '❌'}\n\n`;
        text += `📌 *COMMANDS*\n`;
        text += `  • \`.af on / off\` - Toggle Global AF\n`;
        text += `  • \`.af media <type> on/off\` - Toggle media type\n`;
        text += `  • \`.af set source_jids jid1, jid2\`\n`;
        text += `  • \`.af set target_jids jid1, jid2\`\n\n`;
        text += `⚡ *Contact Us:* wa.me/923453684061 (+923453684061)`;

        return await sock.sendMessage(from, { text }, { quoted: kaif_msg });
    }
};
