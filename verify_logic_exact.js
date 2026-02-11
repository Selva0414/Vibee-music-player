const fetch = require('node-fetch');
const https = require('https');

// Simulate the ENVIRONMENT
const agent = new https.Agent({
    rejectUnauthorized: false
});

const API_BASE = 'https://music-api-xandra.vercel.app/api';
let currentLanguage = 'tamil';

// --- COPIED VERBATIM FROM APP.JS (MOCKING DEPENDENCIES) ---
const cleanText = (str) => {
    if (!str) return '';
    if (typeof str !== 'string') return String(str);
    return str
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
};

const formatSong = (item) => {
    try {
        if (!item) return null;
        return {
            id: item.id || Math.random().toString(),
            name: cleanText(item.name || item.title || 'Unknown Title'),
            albumName: cleanText(item.album?.name || (typeof item.album === 'string' ? item.album : '') || ''),
        };
    } catch (err) {
        console.warn("[Vibee] Error formatting item:", err, item);
        return null;
    }
};

const fetchJsonWithRetry = async (url) => {
    try {
        const res = await fetch(url, { agent });
        if (!res.ok) throw new Error(res.statusText);
        return await res.json();
    } catch (e) {
        console.error("Fetch Error:", e.message);
        return null;
    }
}

// --- SIMULATED AI RESPONSE ---
const mockAiResponse = {
    type: "songs",
    list: [
        { track: "Munbe Vaa", artist: "Sillunu Oru Kadhal" },
        { track: "Ennavale Adi Ennavale", artist: "Kadhalan" },
        { track: "New York Nagaram", artist: "Sillunu Oru Kadhal" }
    ]
};

// --- LOGIC UNDER TEST ---
async function runLogic() {
    let songList = mockAiResponse.list;
    const cleanSearchQuery = (text) => {
        return text
            .replace(/\(.*?\)/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const processBatch = async (batch) => {
        const promises = batch.map(async (songObj) => {
            try {
                let trackName = '';
                let artistName = '';

                if (typeof songObj === 'string') {
                    const parts = songObj.split(' - ');
                    trackName = parts[0];
                    artistName = parts.length > 1 ? parts[1] : '';
                } else {
                    trackName = songObj.track || songObj.name || songObj.title || songObj.song || '';
                    artistName = songObj.artist || songObj.performer || '';
                }

                // Strategy 1
                let query1 = cleanSearchQuery(`${trackName} ${artistName}`);
                console.log(`[Vibee] Searching: ${query1}`);
                let searchUrl = `${API_BASE}/search/songs?query=${encodeURIComponent(query1)}&limit=1`;
                let data = await fetchJsonWithRetry(searchUrl);

                let result = null;
                const getResult = (d) => {
                    if (d?.data?.results && Array.isArray(d.data.results) && d.data.results.length > 0) return d.data.results[0];
                    if (d?.results && Array.isArray(d.results) && d.results.length > 0) return d.results[0];
                    if (d?.data && Array.isArray(d.data) && d.data.length > 0) return d.data[0];
                    return null;
                };
                result = getResult(data);

                // Strategy 2
                if (!result && artistName) {
                    const query2 = cleanSearchQuery(trackName);
                    if (query2 !== query1) {
                        console.log(`[Vibee] Retry with track only: ${query2}`);
                        searchUrl = `${API_BASE}/search/songs?query=${encodeURIComponent(query2)}&limit=1`;
                        data = await fetchJsonWithRetry(searchUrl);
                        result = getResult(data);
                    }
                }

                // Strategy 3
                if (!result) {
                    const query3 = cleanSearchQuery(`${trackName} ${currentLanguage}`);
                    if (query3 && query3 !== query1) {
                        console.log(`[Vibee] Retry with track + lang: ${query3}`);
                        searchUrl = `${API_BASE}/search/songs?query=${encodeURIComponent(query3)}&limit=1`;
                        data = await fetchJsonWithRetry(searchUrl);
                        result = getResult(data);
                    }
                }

                return result ? formatSong(result) : null;
            } catch (e) {
                console.warn('[Vibee] Indiv search error:', e);
                return null;
            }
        });
        return await Promise.all(promises);
    };

    console.log("Starting Batch Process...");
    const results = await processBatch(songList);
    const valid = results.filter(r => r);
    console.log(`\nFound ${valid.length} / ${songList.length} songs.`);
    valid.forEach(s => console.log(` - ${s.name} (${s.albumName})`));
}

runLogic();
