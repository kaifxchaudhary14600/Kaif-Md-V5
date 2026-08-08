/**
 * 🤖 KAIF-MD-V3 🤖
 * Ping Command
 * Developed by Kaif (ixxkaif)
 */
module.exports = {
    name: 'ping',
    aliases: ['p', 'speed'],
    category: 'Information',
    desc: 'Show the bot response speed',
    kaif_handler: async (kaif_sock, kaif_origin, context) => {
        const { kaif_msg } = context;
        const start = Date.now();
        
        // 1. Send "Ping..."
        const pingMsg = await kaif_sock.sendMessage(kaif_origin, { text: '⚡ *Pinging...*' });
        const end = Date.now();
        const responseTime = end - start;

        // 2. Incoming Latency safely handling Protobuf Long
        let msgTime = Date.now();
        if (kaif_msg.messageTimestamp) {
            const ts = typeof kaif_msg.messageTimestamp === 'number'
                ? kaif_msg.messageTimestamp
                : (kaif_msg.messageTimestamp.low || Number(kaif_msg.messageTimestamp) || 0);
            if (ts > 0) msgTime = ts * 1000;
        }
        const incomingLatency = Math.max(0, Date.now() - msgTime);
        
        let report = `🚀 *Pong!*   *${responseTime}ms*\n`;
        report += `📡 *Server Latency:* ${incomingLatency}ms\n\n`;
        report += `⚡ *Send By Kaif (03466859436)*`;

        // Update message
        await kaif_sock.sendMessage(kaif_origin, { 
            text: report, 
            edit: pingMsg.key 
        });
    }
};
