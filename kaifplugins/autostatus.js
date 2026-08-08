/**
 * ⚡ KAIF-MD-V3 ⚡* Auto Status Command
 * Developed by Kaif x Chaudhary
 */
const { kaif_getBotConfig, kaif_updateBotConfig } = require('../kaiflib/database');

module.exports = {
    name: 'autostatus',
    aliases: ['statusseen', 'auto-status'],
    category: 'Settings',
    desc: 'Toggle WhatsApp Auto Status viewing & reactions',
    kaif_handler: async (kaif_sock, kaif_origin, context) => {
        const { kaif_args, sessionId, kaif_isOwner, kaif_msg } = context;

        if (!kaif_isOwner) {
            return await kaif_sock.sendMessage(kaif_origin, {
                text: '⛔ *Access Denied:* Only the bot owner can toggle Auto Status.'
            }, { quoted: kaif_msg });
        }

        const action = kaif_args[0]?.toLowerCase();

        if (action === 'on' || action === '1' || action === 'enable') {
            await kaif_updateBotConfig(sessionId, { autoStatusSeen: true, autoStatusReact: true });
            return await kaif_sock.sendMessage(kaif_origin, {
                text: '✅ *Auto Status is now ENABLED.*\n\nThe bot will view and react to contact statuses automatically.'
            }, { quoted: kaif_msg });
        }

        if (action === 'off' || action === '0' || action === 'disable') {
            await kaif_updateBotConfig(sessionId, { autoStatusSeen: false, autoStatusReact: false });
            return await kaif_sock.sendMessage(kaif_origin, {
                text: '❌ *Auto Status is now DISABLED.*\n\nThe bot will not view contact statuses automatically.'
            }, { quoted: kaif_msg });
        }

        const config = await kaif_getBotConfig(sessionId);
        const currentStatus = (config ? config.autoStatusSeen !== false : true) ? '✅ ON' : '❌ OFF';

        let helpText = '👁️ *AUTO STATUS MANAGER*\n\n';
        helpText += '*Current Status:* ' + currentStatus + '\n\n';
        helpText += '*Usage:*\n';
        helpText += '  `.autostatus on` - Enable Auto Status View & React\n';
        helpText += '  `.autostatus off` - Disable Auto Status View\n\n';
        helpText += '📞 *Contact Us:* wa.me/923453684061 (+923453684061)';

        return await kaif_sock.sendMessage(kaif_origin, { text: helpText }, { quoted: kaif_msg });
    }
};
