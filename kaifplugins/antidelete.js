/**
 * ⚡ KAIF-MD-V3 ⚡* Anti Delete Command
 * Developed by Kaif x Chaudhary
 */
const { kaif_getBotConfig, kaif_updateBotConfig } = require('../kaiflib/database');

module.exports = {
    name: 'antidelete',
    aliases: ['antideleteview', 'anti-delete', 'antidelet'],
    category: 'Settings',
    desc: 'Toggle Anti Delete (sends deleted msgs to owner personal inbox)',
    kaif_handler: async (kaif_sock, kaif_origin, context) => {
        const { kaif_args, sessionId, kaif_isOwner, kaif_msg } = context;

        if (!kaif_isOwner) {
            return await kaif_sock.sendMessage(kaif_origin, {
                text: '⛔ *Access Denied:* Only the bot owner can toggle Anti Delete.'
            }, { quoted: kaif_msg });
        }

        const action = kaif_args[0]?.toLowerCase();

        if (action === 'on' || action === '1' || action === 'enable') {
            await kaif_updateBotConfig(sessionId, { antiDelete: true });
            return await kaif_sock.sendMessage(kaif_origin, {
                text: '✅ *Anti Delete is now ENABLED.*\n\nDeleted messages will be privately sent directly to your personal inbox.'
            }, { quoted: kaif_msg });
        }

        if (action === 'off' || action === '0' || action === 'disable') {
            await kaif_updateBotConfig(sessionId, { antiDelete: false });
            return await kaif_sock.sendMessage(kaif_origin, {
                text: '❌ *Anti Delete is now DISABLED.*\n\nThe bot will not track deleted messages.'
            }, { quoted: kaif_msg });
        }

        const config = await kaif_getBotConfig(sessionId);
        const currentStatus = (config ? config.antiDelete !== false : true) ? '✅ ON' : '❌ OFF';

        let helpText = '🛡️ *ANTI DELETE MANAGER*\n\n';
        helpText += '*Current Status:* ' + currentStatus + '\n';
        helpText += '*Inbox Notification:* 📩 Owner Personal Inbox\n\n';
        helpText += '*Usage:*\n';
        helpText += '  `.antidelete on` - Enable Anti Delete\n';
        helpText += '  `.antidelete off` - Disable Anti Delete\n\n';
        helpText += '📞 *Contact Us:* wa.me/923453684061 (+923453684061)';

        return await kaif_sock.sendMessage(kaif_origin, { text: helpText }, { quoted: kaif_msg });
    }
};
