/**
 * ⚡ KAIF-MD-V3 ⚡
 * Groups JID Utility with Member Counter
 * Developed by Kaif (ixxkaif)
 */
module.exports = {
    name: 'gjids',
    aliases: ['gjid', 'groups', 'groupjids'],
    category: 'Tools',
    desc: 'List all participating groups, member count, and their JIDs',
    kaif_handler: async (kaif_sock, kaif_origin) => {
        try {
            const allGroupsObj = await kaif_sock.groupFetchAllParticipating(); 
            const groupChats = Object.values(allGroupsObj);

            if (groupChats.length === 0) {
                return await kaif_sock.sendMessage(kaif_origin, { text: '⚠️ You are not a member of any groups.' });
            }

            let msg = `📋 *YOUR GROUPS & JIDs* (Total: ${groupChats.length})\n\n`;
            groupChats.forEach((group, index) => {
                const memberCount = group.participants ? group.participants.length : (group.size || 'N/A');
                msg += `${index + 1}. *${group.subject}*\n`;
                msg += `   👥 *Members:* ${memberCount}\n`;
                msg += `   🆔 \`${group.id}\`\n\n`;
            });

            msg += `📞 *Contact Us:* wa.me/923453684061 (+923453684061)`;

            await kaif_sock.sendMessage(kaif_origin, { text: msg.trim() });
        } catch (error) {
            console.error('Error fetching group JIDs:', error);
            await kaif_sock.sendMessage(kaif_origin, { text: '❌ Error fetching groups list.' });
        }
    }
};
