const https = require('https');

function fetchSadSongs() {
    const url = 'https://music-api-xandra.vercel.app/api/search/songs?query=Tamil+sad+songs&limit=10';

    console.log('Fetching Tamil Sad Songs...');

    https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const jsonData = JSON.parse(data);
                // The API structure seems to be { status: 'SUCCESS', data: { results: [...] } }
                const results = jsonData.data?.results || jsonData.results || jsonData.data || [];

                if (results.length === 0) {
                    console.log('No songs found.');
                    return;
                }

                console.log('\n--- Tamil Sad Songs ---\n');
                results.forEach((song, index) => {
                    const name = song.name || song.title || 'Unknown';
                    const artist = typeof song.primaryArtists === 'string' ? song.primaryArtists : (song.artists?.primary?.[0]?.name || 'Unknown Artist');
                    const album = song.album?.name || song.album || 'Unknown Album';
                    console.log(`${index + 1}. ${name}`);
                    console.log(`   Artist: ${artist}`);
                    console.log(`   Album: ${album}`);
                    console.log('------------------------');
                });
            } catch (error) {
                console.error('Error parsing JSON:', error.message);
                console.log('Raw data snippet:', data.substring(0, 100));
            }
        });

    }).on('error', (err) => {
        console.error('Error fetching songs:', err.message);
    });
}

fetchSadSongs();
