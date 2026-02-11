const fetch = require('node-fetch');

const API_KEY = "AIzaSyDL_AcPvG0gYgQIbFbuQRWDx3s5VlpbiMI";
const modelName = "gemini-flash-latest";
const userQuery = "item songs tamil";
const language = "tamil";

async function verifyGemini() {
    console.log(`Testing Gemini with query: "${userQuery}" using model: ${modelName}`);

    const promptText = `
        You are an intelligent music assistant.
        User Query: "${userQuery}"
        Context: Language ${language}

        Return a list of 20 distinct song names that match this vibe, mood, or request.

        OUTPUT JSON FORMAT:
        [
          {"track": "Song Name", "artist": "Artist"},
          {"track": "Song Name", "artist": "Artist"},
          ...
        ]

        RULES:
        - Return ONLY a JSON Array.
        - Ensure strict JSON format.
        - Provide exactly 20 songs.
        - Do not include explanation text.
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const responseText = data.candidates[0].content.parts[0].text;
            console.log("\n--- Raw Response ---");
            console.log(responseText);

            let cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const songs = JSON.parse(cleanText);

            console.log("\n--- Parsed Results ---");
            console.log(`Total songs received: ${songs.length}`);
            songs.forEach((song, index) => {
                console.log(`${index + 1}. ${song.track} - ${song.artist}`);
            });
        } else {
            console.error("Empty or unexpected response structure:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Verification failed:", e.message);
    }
}

verifyGemini();
