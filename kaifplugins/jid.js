/**
 * ⚡ KAIF-MD-V3 ⚡
 * JID Utility
 * Developed by Kaif (ixxkaif)
 */
module.exports = {
    name: 'jid',
    category: 'Debug',
    desc: 'Get the JID of the current chat',
    kaif_handler: async (kaif_sock, kaif_origin) => {
        let text = `🆔 *Chat JID:*\n\`${kaif_origin}\`\n\n`;
        text += `📞 *Contact Us:* wa.me/923453684061 (+923453684061)`;
        await kaif_sock.sendMessage(kaif_origin, { text });
    }
};
