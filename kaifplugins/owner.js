/**
 * ⚡ KAIF-MD-V3 ⚡
 * Owner & Developer Profile Plugin
 * Developed for Kaif (ixxkaif) & @KaifxChaudhary-dev
 */

const config = require('../kaif');

module.exports = {
    name: 'owner',
    aliases: ['creator', 'developer', 'dev', 'superowner'],
    category: 'Information',
    desc: 'Show bot owner contact details, GitHub, and WhatsApp Channel',
    kaif_handler: async (kaif_sock, kaif_origin, context) => {
        const { kaif_msg } = context || {};

        // 1. WhatsApp Contact vCard
        const vcard = 
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            'FN:' + (config.ownerName || 'Kaif Chaudhry') + ' (Super Owner)\n' +
            'ORG:Kaif-MD Bot;\n' +
            'TEL;type=CELL;type=VOICE;waid=923466859436:+92 346 6859436\n' +
            'TEL;type=CELL;type=VOICE;waid=923453684061:+92 345 3684061\n' +
            'TEL;type=CELL;type=VOICE;waid=923298634113:+92 329 8634113\n' +
            'URL:' + (config.githubUrl || 'https://github.com/KaifxChaudhary-dev/Kaif-Md') + '\n' +
            'END:VCARD';

        try {
            await kaif_sock.sendMessage(kaif_origin, {
                contacts: {
                    displayName: config.ownerName || 'Kaif Chaudhry',
                    contacts: [{ vcard }]
                }
            }, { quoted: kaif_msg });
        } catch(e) {}

        // 2. Detailed Profile Message
        let ownerMsg = '👑 *KAIF-MD BOT OWNER & DEVELOPER PROFILE* 👑\n\n';
        ownerMsg += '👤 *Owner Name:* ' + (config.ownerName || 'Kaif Chaudhry') + '\n\n';
        ownerMsg += '📱 *Primary Owner:* +92 346 6859436\n';
        ownerMsg += '👑 *Super Owners List:*\n';
        ownerMsg += '  • +92 346 6859436\n';
        ownerMsg += '  • +92 345 3684061\n';
        ownerMsg += '  • +92 329 8634113\n\n';
        ownerMsg += '💬 *WhatsApp Contact:* ' + (config.ownerContact || 'https://wa.me/923466859436') + '\n';
        ownerMsg += '📢 *WhatsApp Channel:* ' + (config.whatsappChannel || 'https://whatsapp.com/channel/0029VbDMt1C3rZZaigDWAj1X') + '\n';
        ownerMsg += '💻 *GitHub Repository:* ' + (config.githubUrl || 'https://github.com/KaifxChaudhary-dev/Kaif-Md') + '\n\n';
        ownerMsg += '⚡ *Send By Kaif (03466859436)*';

        return await kaif_sock.sendMessage(kaif_origin, { text: ownerMsg }, { quoted: kaif_msg });
    }
};
