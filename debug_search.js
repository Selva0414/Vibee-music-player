const fetch = require('node-fetch');
const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false
});

const API_BASE = 'https://music-api-xandra.vercel.app/api';

const cleanSearchQuery = (text) => {
    return text
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

async function testSearch(trackName, artistName, language) {
    console.log(`\n--- Testing: "${trackName}" by "${artistName}" (${language}) ---`);

    // Strategy 1: Track + Artist
    let query1 = cleanSearchQuery(`${trackName} ${artistName}`);
    console.log(`1. Searching: "${query1}"`);
    let url1 = `${API_BASE}/search/songs?query=${encodeURIComponent(query1)}&limit=1`;
    let res1 = await fetch(url1, { agent }).then(r => r.json()).catch(e => console.error("Err:", e));

    if (res1?.data?.results?.length > 0) {
        console.log("   FOUND in Strategy 1:", res1.data.results[0].name);
        return;
    }
    console.log("   FAILED Strategy 1");

    // Strategy 2: Track Only
    let query2 = cleanSearchQuery(trackName);
    console.log(`2. Searching: "${query2}"`);
    let url2 = `${API_BASE}/search/songs?query=${encodeURIComponent(query2)}&limit=1`;
    let res2 = await fetch(url2, { agent }).then(r => r.json()).catch(e => console.error("Err:", e));

    if (res2?.data?.results?.length > 0) {
        console.log("   FOUND in Strategy 2:", res2.data.results[0].name);
        return;
    }
    console.log("   FAILED Strategy 2");

    // Strategy 3: Track + Language
    let query3 = cleanSearchQuery(`${trackName} ${language}`);
    console.log(`3. Searching: "${query3}"`);
    let url3 = `${API_BASE}/search/songs?query=${encodeURIComponent(query3)}&limit=1`;
    let res3 = await fetch(url3, { agent }).then(r => r.json()).catch(e => console.error("Err:", e));

    if (res3?.data?.results?.length > 0) {
        console.log("   FOUND in Strategy 3:", res3.data.results[0].name);
        return;
    }
    console.log("   FAILED Strategy 3");
}

async function run() {
    // Test cases from "Love Tamil Songs" typical results
    await testSearch("Munbe Vaa", "Sillunu Oru Kadhal", "tamil");
    await testSearch("Ennavale Adi Ennavale", "Kadhalan", "tamil");
    await testSearch("New York Nagaram", "Sillunu Oru Kadhal", "tamil");
    await testSearch("Vaseegara", "Minnale", "tamil");
}

run();
