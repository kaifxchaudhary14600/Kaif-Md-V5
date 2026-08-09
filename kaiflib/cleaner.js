/**
 * ⚡ KAIF-MD-V3 ⚡
 * Cleaner Utility & Auto Temp Cleaner
 * Developed by Kaif (ixxkaif)
 */
const fs = require('fs');
const path = require('path');

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

const OLD_TEXT_REGEX = process.env.OLD_TEXT_REGEX
    ? process.env.OLD_TEXT_REGEX.split(',').map(pattern => {
        try {
            if (!pattern.trim()) return null;
            const escaped = escapeRegex(pattern.trim());
            return new RegExp(escaped, 'gu');
        } catch (e) {
            console.error(`Invalid regex pattern: ${pattern}`, e);
            return null;
        }
      }).filter(regex => regex !== null)
    : [];

const NEW_TEXT = process.env.NEW_TEXT || '';

/**
 * Recursively restores Buffer instances converted to plain JSON objects by JSON.stringify
 */
function restoreBuffers(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every((k, idx) => String(idx) === k)) {
        const arr = new Uint8Array(keys.length);
        for (let i = 0; i < keys.length; i++) arr[i] = obj[i];
        return Buffer.from(arr);
    }
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
    }
    for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === 'object') {
            obj[key] = restoreBuffers(obj[key]);
        }
    }
    return obj;
}

/**
 * Clean forwarded label, newsletter markers, and unwrap media/document wrappers
 */
function processAndCleanMessage(message, customRegexList = null, customNewText = null) {
    try {
        if (!message) return message;
        
        let cleaned = JSON.parse(JSON.stringify(message));
        cleaned = restoreBuffers(cleaned);

        // Unwrap outer viewOnce / documentWithCaption envelopes if present
        if (cleaned.ephemeralMessage) cleaned = cleaned.ephemeralMessage.message;
        if (cleaned.viewOnceMessageV2Extension) cleaned = cleaned.viewOnceMessageV2Extension.message;
        if (cleaned.viewOnceMessageV2) cleaned = cleaned.viewOnceMessageV2.message;
        if (cleaned.viewOnceMessage) cleaned = cleaned.viewOnceMessage.message;
        if (cleaned.documentWithCaptionMessage) cleaned = cleaned.documentWithCaptionMessage.message;
        if (cleaned.imageMessage) delete cleaned.imageMessage.viewOnce;
        if (cleaned.videoMessage) delete cleaned.videoMessage.viewOnce;
        if (cleaned.audioMessage) delete cleaned.audioMessage.viewOnce;

        // Remove all forwarding/newsletter/ad metadata
        const targetBlocks = ['extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
        targetBlocks.forEach(block => {
            if (cleaned[block]) {
                if (cleaned[block].contextInfo) {
                    delete cleaned[block].contextInfo.isForwarded;
                    delete cleaned[block].contextInfo.forwardingScore;
                    delete cleaned[block].contextInfo.forwardedNewsletterMessageInfo;
                    delete cleaned[block].contextInfo.externalAdReply;
                    delete cleaned[block].contextInfo.newsletterJid;
                    delete cleaned[block].contextInfo.newsletterName;
                    delete cleaned[block].contextInfo.newsletterServerMessageId;
                    
                    cleaned[block].contextInfo.isForwarded = false;
                    cleaned[block].contextInfo.forwardingScore = 0;
                }
                
                delete cleaned[block].isForwarded;
                delete cleaned[block].forwardingScore;
            }
        });

        if (cleaned.contextInfo) {
            delete cleaned.contextInfo.isForwarded;
            delete cleaned.contextInfo.forwardingScore;
            delete cleaned.contextInfo.forwardedNewsletterMessageInfo;
            cleaned.contextInfo.isForwarded = false;
        }

        const activeRegexes = (customRegexList && customRegexList.length) ? customRegexList : OLD_TEXT_REGEX;
        const replacementText = customNewText !== null ? customNewText : NEW_TEXT;

        const replaceText = (text) => {
            if (!text || !activeRegexes || !activeRegexes.length) return text;
            let result = text;
            activeRegexes.forEach(regex => {
                try {
                    result = result.replace(regex, replacementText);
                } catch (e) {}
            });
            return result;
        };

        if (cleaned.conversation) cleaned.conversation = replaceText(cleaned.conversation);
        if (cleaned.extendedTextMessage?.text) cleaned.extendedTextMessage.text = replaceText(cleaned.extendedTextMessage.text);
        if (cleaned.imageMessage?.caption) cleaned.imageMessage.caption = replaceText(cleaned.imageMessage.caption);
        if (cleaned.videoMessage?.caption) cleaned.videoMessage.caption = replaceText(cleaned.videoMessage.caption);
        if (cleaned.documentMessage?.caption) cleaned.documentMessage.caption = replaceText(cleaned.documentMessage.caption);

        return cleaned;
    } catch (e) {
        console.error('Cleaning Error:', e.message);
        return message;
    }
}

/**
 * 🧹 Clean temporary media, cache, and junk files
 */
function cleanTempFiles(forceAll = false) {
    const tempDir = path.join(__dirname, '..', 'temp');
    let cleanedCount = 0;

    if (fs.existsSync(tempDir)) {
        try {
            const files = fs.readdirSync(tempDir);
            const now = Date.now();
            const maxAge = forceAll ? 0 : 5 * 60 * 1000;

            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (forceAll || (now - stats.mtimeMs > maxAge)) {
                        fs.unlinkSync(filePath);
                        cleanedCount++;
                    }
                } catch (e) {}
            });
        } catch (e) {
            console.error('Temp directory clean error:', e.message);
        }
    }

    console.log(`🧹 Auto-Cleaner: Cleaned ${cleanedCount} temporary files.`);
    try { const os = require('os'); const osTmp = os.tmpdir(); if (fs.existsSync(osTmp)) { fs.readdirSync(osTmp).forEach(f => { if (f.endsWith('-enc') || f.endsWith('-original') || f.endsWith('.jpg') || f.includes('baileys')) { try { fs.unlinkSync(path.join(osTmp, f)); cleanedCount++; } catch(e){} } }); } } catch(e) {}
    return { success: true, cleanedCount };
}

module.exports = { processAndCleanMessage, cleanTempFiles };
