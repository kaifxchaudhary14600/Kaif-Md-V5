/**
 * ⚡ KAIF-MD-V3 ⚡
 * Forward Command
 * Developed by Kaif (ixxkaif)
 */
module.exports = {
    name: 'forward',
    aliases: ['f'],
    category: 'Tools',
    desc: 'Forward a replied message to multiple JIDs (private, group, or newsletter)',
    kaif_handler: async (kaif_sock, kaif_sender, context) => {
        const { kaif_msg, kaif_args } = context;

        // 1. Get Quoted Message
        let quoted = kaif_msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return await kaif_sock.sendMessage(kaif_sender, { text: '⚠️ Please reply to a message you want to forward.' });
        }

        // 1b. Robust Unwrap & Clean
        if (quoted.viewOnceMessageV2) {
            quoted = quoted.viewOnceMessageV2.message;
        } else if (quoted.viewOnceMessage) {
            quoted = quoted.viewOnceMessage.message;
        }

        const { processAndCleanMessage } = require('../kaiflib/cleaner');
        quoted = processAndCleanMessage(quoted);

        // 2. Parse Targets
        const inputArgs = kaif_args.join(' ');
        if (!inputArgs) {
            const usage = `⚠️ *Invalid Usage*\n\n` +
                `Provide JIDs separated by commas.\n` +
                `Example: \`.f 123@s.whatsapp.net, 456@g.us, 120363@newsletter\`\n\n` +
                `📞 *Contact Us:* wa.me/923453684061 (+923453684061)`;
            return await kaif_sock.sendMessage(kaif_sender, { text: usage });
        }

        const targetJids = inputArgs.split(',').map(j => j.trim()).filter(j => j.length > 0);
        if (targetJids.length === 0) {
            return await kaif_sock.sendMessage(kaif_sender, { text: '⚠️ No valid JIDs found.' });
        }

        // 3. Prepare the Forward (Strip forwarding labels)
        const mType = Object.keys(quoted).find(k => k.endsWith('Message') || k === 'conversation' || k === 'stickerMessage');
        if (mType && quoted[mType] && typeof quoted[mType] === 'object') {
            if (quoted[mType].contextInfo) {
                delete quoted[mType].contextInfo.isForwarded;
                delete quoted[mType].contextInfo.forwardingScore;
                delete quoted[mType].contextInfo.forwardedNewsletterMessageInfo;
                quoted[mType].contextInfo.isForwarded = false;
            }
        }

        // 4. Relay Loop
        let successCount = 0;
        let failCount = 0;
        const failedJids = [];

        for (const jid of targetJids) {
            try {
                let target = jid;
                if (!target.includes('@')) {
                    target = target + '@s.whatsapp.net';
                }

                await kaif_sock.relayMessage(target, quoted, {
                    messageId: kaif_sock.generateMessageTag()
                });

                successCount++;
                await new Promise(r => setTimeout(r, 800));

            } catch (error) {
                console.error(`Relay failed for ${jid}:`, error.message);
                failCount++;
                failedJids.push(jid);
            }
        }

        // 5. Final Report
        if (failCount > 0) {
            let report = `⚠️ *Some JIDs failed to forward*\n\n`;
            report += `❌ *Failed:* ${failCount}\n`;
            report += `🔄 *Mode:* Native Relay\n\n`;
            report += `*Failed List:*\n${failedJids.map(j => `> ${j}`).join('\n')}\n\n`;
            report += `📞 *Contact Us:* wa.me/923453684061 (+923453684061)`;

            await kaif_sock.sendMessage(kaif_sender, { text: report });
        }
    }
};
