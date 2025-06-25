// Test script for Music Map data extraction
// This demonstrates how to extract playlist and track data similar to the #nowplaying dataset

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const ACCESS_TOKEN = 'your_access_token_here'; // Get this from the web interface

// Example playlist ID (you can get this from your playlists)
const EXAMPLE_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M'; // Today's Top Hits

async function testDataExtraction() {
    console.log('🎵 Music Map Data Extraction Test\n');

    try {
        // 1. Get user's playlists
        console.log('1. Fetching user playlists...');
        const playlistsResponse = await axios.get(`${BASE_URL}/user-playlists?limit=5`);
        const playlists = playlistsResponse.data;
        
        console.log(`Found ${playlists.items.length} playlists:`);
        playlists.items.forEach((playlist, index) => {
            console.log(`  ${index + 1}. ${playlist.name} (${playlist.tracks.total} tracks)`);
        });

        // 2. Get detailed playlist information
        if (playlists.items.length > 0) {
            const firstPlaylist = playlists.items[0];
            console.log(`\n2. Getting details for playlist: ${firstPlaylist.name}`);
            
            const playlistDetailsResponse = await axios.get(`${BASE_URL}/playlist/${firstPlaylist.id}?fields=name,description,tracks.total,owner.display_name,images`);
            const playlistDetails = playlistDetailsResponse.data;
            
            console.log(`Playlist: ${playlistDetails.name}`);
            console.log(`Owner: ${playlistDetails.owner.display_name}`);
            console.log(`Tracks: ${playlistDetails.tracks.total}`);
            console.log(`Description: ${playlistDetails.description || 'No description'}`);

            // 3. Get playlist tracks with detailed information
            console.log('\n3. Fetching playlist tracks...');
            const tracksResponse = await axios.get(`${BASE_URL}/playlist/${firstPlaylist.id}/tracks?limit=10&fields=items(track(name,artists(name),album(name),duration_ms,popularity),added_at,added_by.display_name)`);
            const tracks = tracksResponse.data;
            
            console.log(`\nFirst ${tracks.items.length} tracks in playlist:`);
            tracks.items.forEach((item, index) => {
                if (item.track) {
                    const track = item.track;
                    const artists = track.artists.map(artist => artist.name).join(', ');
                    console.log(`  ${index + 1}. ${track.name} - ${artists}`);
                    console.log(`     Album: ${track.album.name}`);
                    console.log(`     Duration: ${Math.round(track.duration_ms / 1000)}s`);
                    console.log(`     Popularity: ${track.popularity}/100`);
                    console.log(`     Added by: ${item.added_by.display_name}`);
                    console.log('');
                }
            });
        }

        // 4. Get user's top tracks
        console.log('4. Fetching user top tracks...');
        const topTracksResponse = await axios.get(`${BASE_URL}/user-top-tracks?limit=5&time_range=medium_term`);
        const topTracks = topTracksResponse.data;
        
        console.log(`\nTop ${topTracks.items.length} tracks:`);
        topTracks.items.forEach((track, index) => {
            const artists = track.artists.map(artist => artist.name).join(', ');
            console.log(`  ${index + 1}. ${track.name} - ${artists}`);
        });

        // 5. Get available genres
        console.log('\n5. Fetching available genres...');
        const genresResponse = await axios.get(`${BASE_URL}/genres`);
        const genres = genresResponse.data;
        
        console.log(`\nAvailable genres (showing first 10):`);
        genres.genres.slice(0, 10).forEach((genre, index) => {
            console.log(`  ${index + 1}. ${genre}`);
        });

        console.log('\n✅ Data extraction test completed successfully!');
        console.log('\n📊 Data Structure Summary:');
        console.log('- Users: Profile information, top tracks, playlists');
        console.log('- Playlists: Name, description, owner, track count, images');
        console.log('- Tracks: Name, artists, album, duration, popularity, added date');
        console.log('- Genres: Available genre seeds for recommendations');

    } catch (error) {
        console.error('❌ Error during data extraction:', error.response?.data || error.message);
        console.log('\n💡 Make sure to:');
        console.log('1. Start the server: npm run dev');
        console.log('2. Authenticate with Spotify in the web interface');
        console.log('3. Get a valid access token');
    }
}

// Example of how to extract data for music mapping
function extractMusicMappingData(playlists, tracks) {
    const musicData = {
        users: [],
        playlists: [],
        tracks: []
    };

    // Extract user data
    if (playlists.items.length > 0) {
        const user = playlists.items[0].owner;
        musicData.users.push({
            id: user.id,
            display_name: user.display_name,
            playlists_count: playlists.total
        });
    }

    // Extract playlist data
    playlists.items.forEach(playlist => {
        musicData.playlists.push({
            id: playlist.id,
            name: playlist.name,
            description: playlist.description,
            owner_id: playlist.owner.id,
            tracks_count: playlist.tracks.total,
            public: playlist.public,
            collaborative: playlist.collaborative
        });
    });

    // Extract track data
    tracks.items.forEach(item => {
        if (item.track) {
            const track = item.track;
            musicData.tracks.push({
                id: track.id,
                name: track.name,
                artists: track.artists.map(artist => ({
                    id: artist.id,
                    name: artist.name
                })),
                album: {
                    id: track.album.id,
                    name: track.album.name
                },
                duration_ms: track.duration_ms,
                popularity: track.popularity,
                added_at: item.added_at,
                added_by: item.added_by.id
            });
        }
    });

    return musicData;
}

// Run the test
if (require.main === module) {
    testDataExtraction();
}

module.exports = { testDataExtraction, extractMusicMappingData }; 