const fetch = require('node-fetch');

const API_KEY = "AIzaSyC0r72PtOS-JtBJpGa0UjMOt8BcmpuTNQc";
const userQuery = "tamil love songs";
const language = "tamil";

async function testGeminiFetch() {
    console.log(`Testing Gemini Fetch with query: "${userQuery}"`);

    const promptText = `
        You are an intelligent music assistant.
        User Query: "${userQuery}"
        Context: Language ${language}

        Determine if the user is asking for a specific MOVIE, ALBUM, or ARTIST, or just a VIBE/PLAYLIST.

        OUTPUT JSON FORMAT:
        {
          "type": "album", 
          "query": "Movie Name",
          "list": [{"track": "Song Name", "artist": "Artist/Movie"}] // REQUIRED: Backup list of 40 songs
        }
        OR
        {
          "type": "artist", 
          "query": "Artist Name",
          "list": [{"track": "Song Name", "artist": "Artist"}] // REQUIRED: Backup list of 40 top songs
        }
        OR
        {
          "type": "songs", 
          "list": [{"track": "Song Name", "artist": "Artist/Movie"}] // REQUIRED: List of 40 top songs
        }

        RULES:
        - ALWAYS include the "list" array, even for album/artist types. This is used as a fallback.
        - If it's a specific movie (e.g. "Dude"), return type "album".
        - If it's a specific artist, return type "artist".
        - Result must be valid JSON only.
        - ENSURE the list contains at least 40 songs.`;

    const modelsToTry = ["gemini-flash-latest", "gemini-pro-latest"];

    for (const modelName of modelsToTry) {
        try {
            console.log(`[Gemini] Attempting with model: ${modelName}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: promptText }]
                    }]
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                if (response.status === 429) {
                    console.warn(`Rate Limit exceeded for ${modelName}`);
                    continue;
                }
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();
            if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const text = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
                console.log("\nSuccess! Raw Response snippet:");
                console.log(text.substring(0, 200) + "...");
                const json = JSON.parse(text);
                console.log("\nParsed JSON Type:", json.type);
                console.log("Number of songs:", json.list?.length);
                return;
            } else {
                throw new Error("Empty response from Gemini API");
            }
        } catch (e) {
            console.warn(`[Gemini] Failed with ${modelName}:`, e.message);
        }
    }
    console.error("All models failed.");
}

testGeminiFetch();
