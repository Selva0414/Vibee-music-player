const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = "AIzaSyC0r72PtOS-JtBJpGa0UjMOt8BcmpuTNQc";
const genAI = new GoogleGenerativeAI(API_KEY);

async function testGemini() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const userQuery = "tamil love songs";
        const language = "tamil";

        const prompt = `
        You are an intelligent music assistant.
        User Query: "${userQuery}"
        Context: Language ${language}

        Determine if the user is asking for a specific MOVIE, ALBUM, or ARTIST, or just a VIBE/PLAYLIST.

        OUTPUT JSON FORMAT:
        {
          "type": "album", 
          "query": "Movie Name",
          "list": [{"track": "Song Name", "artist": "Artist/Movie"}] // REQUIRED: Backup list of 20+ songs
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
          "list": [{"track": "Song Name", "artist": "Artist/Movie"}] // 20-30 top songs
        }

        RULES:
        - ALWAYS include the "list" array, even for album/artist types. This is used as a fallback.
        - If it's a specific movie (e.g. "Dude"), return type "album".
        - If it's a specific artist, return type "artist".
        - Result must be valid JSON only.
      `;

        console.log("Sending request to Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log("Raw Response:");
        console.log(text);

        // Validate JSON
        try {
            const json = JSON.parse(text);
            console.log("\nParsed JSON successfully!");
            console.log("Type:", json.type);
            console.log("List Length:", json.list ? json.list.length : 0);
            console.log("First item:", json.list ? json.list[0] : "N/A");
        } catch (e) {
            console.error("Failed to parse JSON:", e.message);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

testGemini();
