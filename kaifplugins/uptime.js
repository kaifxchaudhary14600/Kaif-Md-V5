/**
 * ⚡ KAIF-MD-V3 ⚡
 * Uptime Command
 * Developed by Kaif (ixxkaif)
 */
module.exports = {
    name: 'uptime',
    category: 'Information',
    desc: 'Show the bot uptime',
    kaif_handler: async (kaif_sock, kaif_origin, context) => {
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / (3600 * 24));
        const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        let uptimeStr = `*⏰ Bot Uptime*\n\n`;
        if (days > 0) uptimeStr += `*Days:* ${days}d `;
        if (hours > 0) uptimeStr += `*Hours:* ${hours}h `;
        if (minutes > 0) uptimeStr += `*Minutes:* ${minutes}m `;
        uptimeStr += `*Seconds:* ${seconds}s\n\n`;
        uptimeStr += `📞 *Contact Us:* wa.me/923453684061 (+923453684061)`;

        await kaif_sock.sendMessage(kaif_origin, { text: uptimeStr });
    }
};
