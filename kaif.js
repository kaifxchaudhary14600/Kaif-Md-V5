require('dotenv').config();
const fs = require('fs');
const path = require('path');

function getSessionId() {
    const envSessionId = process.env.SESSION_ID ? process.env.SESSION_ID.trim() : '';

    // 1. Environment Variable (if specified)
    if (envSessionId) {
        return envSessionId;
    }

    const sessionIdFile = path.join(__dirname, '.session_id');
    const sessionCounterFile = path.join(__dirname, '.session_counter');

    // 2. Same Deployment Stability (re-use existing .session_id if present on current deployment)
    if (fs.existsSync(sessionIdFile)) {
        try {
            const existingId = fs.readFileSync(sessionIdFile, 'utf8').trim();
            if (existingId) return existingId;
        } catch (e) {
            // Fall back if file read fails
        }
    }

    // 3. Infinite Unique Deployment Generator
    const patterns = ['123', '456', '678', '901', '112', '345'];
    let counter = 0;

    if (fs.existsSync(sessionCounterFile)) {
        try {
            const countStr = fs.readFileSync(sessionCounterFile, 'utf8').trim();
            const parsed = parseInt(countStr, 10);
            if (!isNaN(parsed)) counter = parsed;
        } catch (e) {
            counter = 0;
        }
    }

    counter += 1;
    const prefix = (envSessionId === 'wasi_session') ? 'wasi_session' : 'kaif_session';
    
    let generatedSessionId;
    if (counter <= patterns.length) {
        generatedSessionId = `${prefix}${patterns[counter - 1]}`;
    } else {
        generatedSessionId = `${prefix}_dep${counter}`;
    }

    try {
        fs.writeFileSync(sessionCounterFile, String(counter), 'utf8');
        fs.writeFileSync(sessionIdFile, generatedSessionId, 'utf8');
    } catch (e) {
        console.error('Failed to write session ID files:', e.message);
    }

    return generatedSessionId;
}

module.exports = {
    sessionId: getSessionId(),
    mongoDbUrl: process.env.MONGODB_URI || process.env.MONGODB_URL || '',
    superOwners: ['923298634113', '923453684061', '923466859436'],
    ownerName: 'Kaif Chaudhry',
    ownerNumber: process.env.OWNER_NUMBER || '923466859436',
    ownerContact: 'https://wa.me/923466859436',
    githubUrl: 'https://github.com/KaifxChaudhary-dev/Kaif-Md',
    whatsappChannel: 'https://whatsapp.com/channel/0029VbDMt1C3rZZaigDWAj1X'
};
