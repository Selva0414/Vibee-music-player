const fetch = require('node-fetch');

const API_KEY = "AIzaSyDL_AcPvG0gYgQIbFbuQRWDx3s5VlpbiMI";

async function listModels() {
    console.log("Listing available models...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods?.includes("generateContent")) {
                    console.log(` - ${m.name}`);
                }
            });
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
