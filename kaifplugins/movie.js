const { cleanTempFiles } = require('../kaiflib/cleaner');
/**
 * ⚡ KAIF-MD-V3 ⚡
 * Movie & Direct-Cloud Downloader Plugin (Clean Document Delivery, No Long Link In Caption)
 * Developed for Kaif (ixxkaif) & @KaifxChaudhary-dev
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// In-memory store for active movie sessions per chat
const activeMovieSessions = new Map();

// activeMovieSessions auto-expiry (10 minute TTL)
setInterval(() => {
    const now = Date.now();
    for (const [origin, session] of activeMovieSessions.entries()) {
        if (session && session.timestamp && (now - session.timestamp > 10 * 60 * 1000)) {
            activeMovieSessions.delete(origin);
        }
    }
}, 3 * 60 * 1000);


function fetchUrl(targetUrl, headers = {}, redirects = 10) {
    return new Promise((resolve, reject) => {
        if (redirects <= 0) return reject(new Error('Too many redirects'));
        let u;
        try { u = new URL(targetUrl); } catch (e) { return reject(new Error('Invalid URL: ' + targetUrl)); }
        const client = u.protocol === 'https:' ? https : http;
        const options = {
            hostname: u.hostname,
            port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...headers
            }
        };
        const req = client.request(options, (res) => {
            let cookies = res.headers['set-cookie'] ? res.headers['set-cookie'].join('; ') : '';
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const nextUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, targetUrl).href;
                return fetchUrl(nextUrl, { ...headers, Cookie: cookies }, redirects - 1).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data, finalUrl: targetUrl }));
        });
        req.on('error', reject);
        req.end();
    });
}


function getRemoteStream(targetUrl, redirects = 10) {
    return new Promise((resolve, reject) => {
        if (redirects <= 0) return reject(new Error('Too many redirects'));
        let u;
        try { u = new URL(targetUrl); } catch (e) { return reject(new Error('Invalid URL: ' + targetUrl)); }
        const client = u.protocol === 'https:' ? https : http;
        const req = client.get(targetUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': '*/*'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const nextUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, targetUrl).href;
                return getRemoteStream(nextUrl, redirects - 1).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error('HTTP status ' + res.statusCode));
            }
            resolve(res);
        });
        req.on('error', reject);
    });
}

function downloadFileToTemp(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        let u;
        try { u = new URL(url); } catch (e) { return reject(e); }
        const client = u.protocol === 'https:' ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': '*/*'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFileToTemp(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error('HTTP status ' + res.statusCode));
            }
            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            const fileStream = fs.createWriteStream(destPath, { highWaterMark: 64 * 1024 });
            res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0 && onProgress) {
                    onProgress(downloadedBytes, totalBytes);
                }
            });
            res.pipe(fileStream);
            fileStream.on('finish', () => { fileStream.close(() => resolve({ destPath, totalBytes })); });
            fileStream.on('error', (err) => {
                try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) { }
                reject(err);
            });
        });
        req.on('error', (err) => {
            try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) { }
            reject(err);
        });
    });
}

function cleanMovieTitle(title) {
    if (!title) return 'Movie File';
    return title
        .replace(/SSRmovies\.COM\s*-\s*/gi, '')
        .replace(/SSRmovies\.COM/gi, '')
        .replace(/SSR\.COM/gi, '')
        .replace(/SSRmovies/gi, '')
        .trim();
}

async function resolveDirectCloud(storageUrl) {
    const { body, headers } = await fetchUrl(storageUrl);
    let cookies = headers['set-cookie'] ? headers['set-cookie'].join('; ') : '';
    const tokenMatch = body.match(/data-token="([^"]+)"/);
    const uidMatch = body.match(/data-uid="([^"]+)"/);
    const titleMatch = body.match(/SSRmovies\.COM[^<]+/i);
    const sizeMatch = body.match(/File Size[\s\S]*?text-blue-400">([^<]+)</i);
    const resMatch = body.match(/Resolution[\s\S]*?text-blue-400">([^<]+)</i);
    if (!tokenMatch || !uidMatch) { throw new Error('Could not extract security token from Direct-Cloud link.'); }
    const token = tokenMatch[1];
    const uid = uidMatch[1];
    const rawFileName = titleMatch ? titleMatch[0].trim() : 'Movie File';
    const fileName = cleanMovieTitle(rawFileName);
    const fileSize = sizeMatch ? sizeMatch[1].trim() : 'Unknown';
    const resolution = resMatch ? resMatch[1].trim() : 'Unknown';
    const payload = JSON.stringify({ type: 'DOWNLOAD_GENERATE', payload: { uid, access_token: token } });
    const u = new URL('https://storage.direct-cloud.org/action');
    const result = await new Promise((resolve, reject) => {
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': USER_AGENT,
                'Cookie': cookies,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let resBody = '';
            res.on('data', c => resBody += c);
            res.on('end', () => {
                try { resolve(JSON.parse(resBody)); } catch (e) { reject(new Error('Invalid JSON response')); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
    if (result && result.download_url) {
        return { fileName, fileSize, resolution, downloadUrl: result.download_url };
    } else {
        throw new Error(result.error || 'Failed to generate download link');
    }
}

async function resolveToDirectCloudLink(inputUrl) {
    if (inputUrl.includes('direct-cloud.org') || inputUrl.includes('direct-cloud.top')) { return inputUrl; }
    try {
        const { body, finalUrl } = await fetchUrl(inputUrl);
        if (finalUrl.includes('direct-cloud.org') || finalUrl.includes('direct-cloud.top')) { return finalUrl; }
        const dcMatch = body.match(/https?:\/\/[^\s"']*direct-cloud[^\s"']*/i);
        if (dcMatch) { return dcMatch[0].replace(/<\/a>.*$/i, '').trim(); }
    } catch (e) { }
    return null;
}

async function searchSsrmovies(query) {
    const searchUrl = 'https://ssrmovies.cab/?s=' + encodeURIComponent(query);
    const { body } = await fetchUrl(searchUrl);
    const matches = body.match(/<a\s+[^>]*href="([^"]+)"\s+title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi) || [];
    const results = [];
    const seen = new Set();
    for (const match of matches) {
        const hrefM = match.match(/href="([^"]+)"/);
        const titleM = match.match(/title="([^"]+)"/);
        if (hrefM && titleM && (hrefM[1].includes('ssrmovies.cab/') || hrefM[1].includes('ssrmovies.faith/') || hrefM[1].includes('ssrmovies.'))) {
            const url = hrefM[1];
            if (!seen.has(url) && !url.includes('/category/') && !url.includes('/page/')) {
                seen.add(url);
                results.push({
                    title: cleanMovieTitle(titleM[1].replace(/&#8217;/g, "'").replace(/&#038;/g, "&").trim()),
                    url: url
                });
            }
        }
    }
    return results;
}

async function getMovieDownloadLinks(movieUrl) {
    const { body } = await fetchUrl(movieUrl);
    const titleM = body.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i) || body.match(/<title>([^<]+)<\/title>/i);
    const rawTitle = titleM ? titleM[1].trim() : 'Movie Details';
    const title = cleanMovieTitle(rawTitle);
    const links = [];
    const seenUrls = new Set();
    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(body)) !== null) {
        const url = match[1];
        const text = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
        if ((url.includes('direct-cloud') || url.includes('linkszilla') || url.includes('/d/') || url.includes('/view/')) && !seenUrls.has(url) && !url.includes('guide')) {
            seenUrls.add(url);
            links.push({ url, text });
        }
    }
    return { title, links };
}

async function sendMovieFile(kaif_sock, kaif_origin, selected, kaif_msg) {
    let remoteStream = null;
    const cleanName = cleanMovieTitle(selected.fileName);
    const ext = cleanName.endsWith('.mkv') ? '.mkv' : '.mp4';
    let baseName = cleanName;
    if (baseName.endsWith('.mkv') || baseName.endsWith('.mp4')) {
        baseName = baseName.substring(0, baseName.lastIndexOf('.'));
    }
    const docFileName = baseName + ' - Send By Kaif (03466859436)' + ext;
    const statusText = '⚡ *Downloading & Uploading ' + baseName + ' (' + selected.resolution + ')...*\n\n📁 *Size:* ' + selected.fileSize + '\n⏳ *Please wait... Streaming document to WhatsApp...*\n\n👤 *Send By Kaif (03466859436)*';
    let statusMsg;
    try {
        statusMsg = await kaif_sock.sendMessage(kaif_origin, { text: statusText }, { quoted: kaif_msg });
    } catch (e) { }
    const docCaption = '⚡ *' + baseName + '*';
    try {
        console.log('[MOVIE-STREAM] Connecting to remote stream: ' + selected.downloadUrl + '...');
        remoteStream = await getRemoteStream(selected.downloadUrl);
        console.log('[MOVIE-STREAM] Remote stream connected! Uploading document to WhatsApp...');

        await kaif_sock.sendMessage(kaif_origin, {
            document: { stream: remoteStream },
            fileName: docFileName,
            mimetype: 'video/mp4',
            caption: docCaption
        }, { quoted: kaif_msg });
        console.log('[MOVIE-STREAM] Document sent successfully!');
    } catch (err) {
        console.error('[MOVIE-STREAM] Document delivery error:', err.message);
        const fallbackText = '⚡ *' + baseName + '*';
        await kaif_sock.sendMessage(kaif_origin, { text: fallbackText }, { quoted: kaif_msg });
    } finally {
        if (remoteStream && typeof remoteStream.destroy === 'function') {
            try { remoteStream.destroy(); } catch (e) { }
        }
        try { cleanTempFiles(true); } catch (e) { }
        if (global.gc) {
            try { global.gc(); console.log('[MOVIE-STREAM] Executed V8 garbage collection.'); } catch (e) { }
        }
    }
}

module.exports = {
    name: 'movie',
    aliases: ['movies', 'ssrmovie', 'ssrmovies', 'directcloud', 'dlmovie'],
    category: 'Tools',
    desc: 'Search, stream, and download movies from SSRmovies / Direct-Cloud',
    kaif_handler: async (kaif_sock, kaif_origin, context) => {
        const { kaif_args, kaif_text, text, kaif_msg } = context || {};
        let query = '';
        if (kaif_args && Array.isArray(kaif_args) && kaif_args.length > 0) {
            query = kaif_args.join(' ').trim();
        } else if (kaif_text) {
            query = kaif_text.replace(/^\.\w+\s*/, '').trim();
        } else if (text) {
            query = text.replace(/^\.\w+\s*/, '').trim();
        }
        const selectedNum = parseInt(query, 10);
        if (!isNaN(selectedNum) && selectedNum > 0 && activeMovieSessions.has(kaif_origin)) {
            const session = activeMovieSessions.get(kaif_origin);
            activeMovieSessions.delete(kaif_origin);
            if (session && session.options && session.options[selectedNum - 1]) {
                const selected = session.options[selectedNum - 1];
                await sendMovieFile(kaif_sock, kaif_origin, selected, kaif_msg);
                return;
            }
        }
        if (!query) {
            let helpMsg = '*🎬 MOVIE & DIRECT DOWNLOADER*\n\n';
            helpMsg += '📌 *Usage Examples:*\n';
            helpMsg += '• .movie WWE — Search movies\n';
            helpMsg += '• .movie https://ssrmovies.cab/movie-slug/ — View 1080p, 720p, 480p options\n';
            helpMsg += '• .movie 1 — Reply 1, 2, or 3 to receive document file\n\n';
            helpMsg += '📲 *Send By Kaif (03466859436)*';
            return await kaif_sock.sendMessage(kaif_origin, { text: helpMsg });
        }
        let statusMsg;
        try {
            statusMsg = await kaif_sock.sendMessage(kaif_origin, { text: '🔍 *Resolving qualities... Please wait...*' });
        } catch (e) { }
        try {
            if (query.includes('direct-cloud.org') || query.includes('direct-cloud.top') || query.includes('linkszilla.top')) {
                let targetUrl = query;
                const dcUrl = await resolveToDirectCloudLink(targetUrl);
                if (dcUrl) targetUrl = dcUrl;
                if (targetUrl.includes('dl.direct-cloud.top')) {
                    const redirected = await fetchUrl(targetUrl);
                    targetUrl = redirected.finalUrl;
                }
                const movieData = await resolveDirectCloud(targetUrl);
                const selected = {
                    qualityLabel: 'Direct Download',
                    fileName: movieData.fileName,
                    fileSize: movieData.fileSize,
                    resolution: movieData.resolution,
                    downloadUrl: movieData.downloadUrl
                };
                await sendMovieFile(kaif_sock, kaif_origin, selected, kaif_msg);
                return;
            }
            if (query.includes('ssrmovies.cab/') || query.includes('ssrmovies.faith/') || query.includes('ssrmovies.')) {
                const movie = await getMovieDownloadLinks(query);
                if (movie.links.length === 0) {
                    const msgOptions = { text: '❌ No download links found on this page.' };
                    if (statusMsg && statusMsg.key) msgOptions.edit = statusMsg.key;
                    await kaif_sock.sendMessage(kaif_origin, msgOptions);
                    return;
                }
                const resolvedDownloads = [];
                const seenQualities = new Set();
                for (const item of movie.links) {
                    const qualityMatch = item.text.match(/(1080p|720p|480p)/i);
                    const qualityKey = qualityMatch ? qualityMatch[1].toLowerCase() : item.text;
                    if (seenQualities.has(qualityKey)) continue;
                    const dcUrl = await resolveToDirectCloudLink(item.url);
                    if (dcUrl) {
                        try {
                            let targetDcUrl = dcUrl;
                            if (targetDcUrl.includes('dl.direct-cloud.top')) {
                                const redirected = await fetchUrl(targetDcUrl);
                                targetDcUrl = redirected.finalUrl;
                            }
                            const fileData = await resolveDirectCloud(targetDcUrl);
                            seenQualities.add(qualityKey);
                            resolvedDownloads.push({
                                qualityLabel: item.text,
                                fileName: fileData.fileName,
                                fileSize: fileData.fileSize,
                                resolution: fileData.resolution,
                                downloadUrl: fileData.downloadUrl
                            });
                        } catch (err) { }
                    }
                }
                if (resolvedDownloads.length === 0) {
                    const msgOptions = { text: '❌ Could not auto-resolve direct download links for this movie.' };
                    if (statusMsg && statusMsg.key) msgOptions.edit = statusMsg.key;
                    await kaif_sock.sendMessage(kaif_origin, msgOptions);
                    return;
                }
                activeMovieSessions.set(kaif_origin, { options: resolvedDownloads, timestamp: Date.now() });
                let caption = '*🎬 ' + movie.title + '*\n\n';
                caption += '✅ *SELECT QUALITY OPTION TO GET DOCUMENT FILE:*\n\n';
                resolvedDownloads.forEach((dl, idx) => {
                    caption += '*' + (idx + 1) + '. ' + dl.qualityLabel + '*\n';
                    caption += '📏 *Resolution:* ' + dl.resolution + ' | ⚖️ *Size:* ' + dl.fileSize + '\n\n';
                });
                caption += '👇 *REPLY WITH .movie 1, .movie 2, OR .movie 3 TO RECEIVE DOCUMENT FILE!*\n\n';
                caption += '📲 *Send By Kaif (03466859436)*';
                const msgOptions = { text: caption };
                if (statusMsg && statusMsg.key) msgOptions.edit = statusMsg.key;
                await kaif_sock.sendMessage(kaif_origin, msgOptions);
                return;
            }
            const searchResults = await searchSsrmovies(query);
            if (searchResults.length === 0) {
                const msgOptions = { text: '❌ *No movies found for:* "' + query + '"\n\nPlease check spelling or try another keyword.' };
                if (statusMsg && statusMsg.key) msgOptions.edit = statusMsg.key;
                return await kaif_sock.sendMessage(kaif_origin, msgOptions);
            }
            let responseText = '🔎 *SEARCH RESULTS FOR:* "' + query + '"\n\n';
            searchResults.slice(0, 6).forEach((res, idx) => {
                responseText += '*' + (idx + 1) + '. ' + res.title + '*\n🔗 ' + res.url + '\n\n';
            });
            responseText += '💡 *To view 1080p, 720p & 480p options, send:* .movie <movie_url>\n\n';
            responseText += '📲 *Send By Kaif (03466859436)*';
            const msgOptions = { text: responseText };
            if (statusMsg && statusMsg.key) msgOptions.edit = statusMsg.key;
            await kaif_sock.sendMessage(kaif_origin, msgOptions);
        } catch (error) {
            console.error('Movie plugin error:', error);
            const msgOptions = { text: '❌ *Error processing request:*\n' + error.message };
            if (statusMsg && statusMsg.key) msgOptions.edit = statusMsg.key;
            await kaif_sock.sendMessage(kaif_origin, msgOptions);
        }
    }
};