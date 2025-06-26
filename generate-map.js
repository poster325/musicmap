// Artist Map Generator with Dataset Capture and Chunk Handling
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const SPOTIFY_CLIENT_ID = '1b0ff5378cca441899cca8bebaf71d1a';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const MAX_PLAYLISTS = 200; // Limit for large data
const CHUNK_SIZE = 20; // Number of playlists per chunk

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

async function getAccessToken() {
    const response = await axios.post('https://accounts.spotify.com/api/token',
        new URLSearchParams({ grant_type: 'client_credentials' }), {
            headers: {
                'Authorization': `Basic ${Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    return response.data.access_token;
}

async function fetchActivePlaylists(token) {
    // Featured, new releases, and top categories
    const featured = await axios.get('https://api.spotify.com/v1/browse/featured-playlists?limit=50&country=US', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const categories = await axios.get('https://api.spotify.com/v1/browse/categories?limit=20&country=US', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const categoryPlaylists = [];
    for (const category of categories.data.categories.items.slice(0, 10)) {
        try {
            const response = await axios.get(`https://api.spotify.com/v1/browse/categories/${category.id}/playlists?limit=10&country=US`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            categoryPlaylists.push(...response.data.playlists.items.map(p => ({ ...p, category: category.name })));
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.warn(`Failed to fetch ${category.name}:`, error.message);
        }
    }
    return [...featured.data.playlists.items, ...categoryPlaylists].slice(0, MAX_PLAYLISTS);
}

async function getPlaylistTracks(playlist, token) {
    try {
        const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100&market=US`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return { ...playlist, tracks: response.data };
    } catch (error) {
        console.warn(`Failed to get tracks for ${playlist.name}:`, error.message);
        return null;
    }
}

async function fetchAndSaveDataset() {
    const token = await getAccessToken();
    const playlists = await fetchActivePlaylists(token);
    const date = todayStr();
    const datasetDir = path.join('dataset');
    await fs.mkdir(datasetDir, { recursive: true });
    const datasetPath = path.join(datasetDir, `playlists-${date}.jsonl`);
    
    // Chunked fetching and saving
    let count = 0;
    for (let i = 0; i < playlists.length; i += CHUNK_SIZE) {
        const chunk = playlists.slice(i, i + CHUNK_SIZE);
        const chunkWithTracks = [];
        for (const playlist of chunk) {
            const playlistWithTracks = await getPlaylistTracks(playlist, token);
            if (playlistWithTracks) chunkWithTracks.push(playlistWithTracks);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        // Append chunk to file as JSONL
        for (const pl of chunkWithTracks) {
            await fs.appendFile(datasetPath, JSON.stringify(pl) + '\n');
            count++;
        }
        console.log(`Saved ${count}/${playlists.length} playlists to ${datasetPath}`);
    }
    console.log(`✅ Dataset saved: ${datasetPath}`);
    return datasetPath;
}

async function loadDataset(datasetPath) {
    const lines = (await fs.readFile(datasetPath, 'utf-8')).split('\n').filter(Boolean);
    return lines.map(line => JSON.parse(line));
}

function buildArtistGraph(playlists) {
    const nodes = new Map();
    const edges = new Map();
    for (const playlist of playlists) {
        if (!playlist.tracks || !playlist.tracks.items) continue;
        const tracks = playlist.tracks.items.filter(item => item.track && item.track.id);
        const playlistArtists = new Set();
        tracks.forEach(track => {
            track.track.artists.forEach(artist => {
                playlistArtists.add(artist.id);
                if (!nodes.has(artist.id)) {
                    nodes.set(artist.id, {
                        id: artist.id,
                        name: artist.name,
                        trackCount: 1,
                        totalPopularity: track.track.popularity || 0,
                        releaseYears: new Set([new Date(track.track.album.release_date).getFullYear()])
                    });
                } else {
                    const node = nodes.get(artist.id);
                    node.trackCount += 1;
                    node.totalPopularity += track.track.popularity || 0;
                    node.releaseYears.add(new Date(track.track.album.release_date).getFullYear());
                }
            });
        });
        // Co-occurrence edges
        const artistArray = Array.from(playlistArtists);
        for (let i = 0; i < artistArray.length; i++) {
            for (let j = i + 1; j < artistArray.length; j++) {
                const [id1, id2] = [artistArray[i], artistArray[j]].sort();
                const edgeKey = `${id1}-${id2}`;
                if (edges.has(edgeKey)) {
                    edges.get(edgeKey).weight += 1;
                } else {
                    edges.set(edgeKey, { source: id1, target: id2, weight: 1 });
                }
            }
        }
    }
    // Node properties
    nodes.forEach(node => {
        node.avgPopularity = Math.round(node.totalPopularity / node.trackCount);
        node.avgReleaseYear = Math.round([...node.releaseYears].reduce((a, b) => a + b, 0) / node.releaseYears.size);
        node.size = Math.max(15, Math.min(80, Math.log(node.trackCount + 1) * 5 + node.avgPopularity * 0.3));
        const currentYear = new Date().getFullYear();
        const age = currentYear - node.avgReleaseYear;
        const normalizedAge = Math.min(age / 50, 1);
        node.color = `rgb(${Math.round(255 * normalizedAge)}, 100, ${Math.round(255 * (1 - normalizedAge))})`;
    });
    // Filter edges
    const filteredEdges = Array.from(edges.values()).filter(edge => edge.weight >= 3);
    return {
        nodes: Array.from(nodes.values()).map(node => ({ data: node })),
        edges: filteredEdges.map(edge => ({
            data: {
                ...edge,
                id: `${edge.source}-${edge.target}`,
                thickness: Math.max(1, Math.min(15, Math.log(edge.weight + 1) * 3))
            }
        }))
    };
}

async function buildGraphFromDataset(datasetPath, spotifyToken = null) {
    const playlists = await loadDataset(datasetPath);
    const graphConstructor = new ArtistGraphConstructor();
    
    // Set Spotify token if provided
    if (spotifyToken) {
        graphConstructor.setSpotifyToken(spotifyToken);
    }
    
    const graphData = await graphConstructor.buildGraphFromPlaylists(playlists);
    const mapData = {
        metadata: {
            generatedAt: new Date().toISOString(),
            playlistsAnalyzed: playlists.length,
            artists: graphData.nodes.length,
            connections: graphData.edges.length,
            method: 'PMI (Pointwise Mutual Information)',
            popularitySource: spotifyToken ? 'Artist Top Tracks' : 'Playlist Average'
        },
        graph: graphData
    };
    const outPath = path.join('public', `artist-map-${todayStr()}.json`);
    await fs.mkdir('public', { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(mapData, null, 2));
    console.log(`✅ Map generated: ${outPath}`);
}

// CLI usage: node generate-map.js fetch | build [datasetPath]
if (require.main === module) {
    const mode = process.argv[2];
    if (mode === 'fetch') {
        fetchAndSaveDataset();
    } else if (mode === 'build') {
        const datasetPath = process.argv[3];
        if (!datasetPath) {
            console.error('Usage: node generate-map.js build <datasetPath>');
            process.exit(1);
        }
        buildGraphFromDataset(datasetPath);
    } else {
        console.log('Usage: node generate-map.js fetch | build <datasetPath>');
    }
}

// Export functions for use in server.js
module.exports = {
    fetchAndSaveDataset,
    buildGraphFromDataset,
    todayStr
}; 