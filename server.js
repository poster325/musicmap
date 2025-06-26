const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const path = require('path');

// Import map generation functions
const { fetchAndSaveDataset, buildGraphFromDataset } = require('./generate-map.js');

// Add multer for file uploads
const multer = require('multer');
const upload = multer({ dest: 'tmp/' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Spotify configuration
const SPOTIFY_CLIENT_ID = '1b0ff5378cca441899cca8bebaf71d1a';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Store access token for client credentials flow
let accessToken = null;
let tokenExpiry = 0;

// Get access token using client credentials flow
async function getAccessToken() {
    // Check if current token is still valid (with 5 minute buffer)
    if (accessToken && Date.now() < tokenExpiry - 300000) {
        return accessToken;
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'client_credentials'
            }), {
                headers: {
                    'Authorization': `Basic ${Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        
        console.log('✅ Spotify access token refreshed');
        return accessToken;
    } catch (error) {
        console.error('❌ Failed to get access token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Spotify');
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/visualization', (req, res) => {
    res.sendFile(__dirname + '/music-map-visualization.html');
});

// New endpoint to fetch and save dataset
app.post('/api/fetch-dataset', async (req, res) => {
    try {
        console.log('🔄 Starting dataset fetch from web interface...');
        
        if (!SPOTIFY_CLIENT_SECRET) {
            return res.status(500).json({ error: 'SPOTIFY_CLIENT_SECRET not configured' });
        }
        
        const datasetPath = await fetchAndSaveDataset();
        
        res.json({ 
            success: true, 
            message: 'Dataset fetched and saved successfully',
            datasetPath: datasetPath
        });
    } catch (error) {
        console.error('❌ Dataset fetch failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// New endpoint to build map from dataset
app.post('/api/build-map', async (req, res) => {
    try {
        const { datasetPath } = req.body;
        
        if (!datasetPath) {
            return res.status(400).json({ error: 'Dataset path is required' });
        }
        
        console.log('🔄 Building map from dataset:', datasetPath);
        
        // Get Spotify token for artist popularity fetching
        const token = await getAccessToken();
        
        await buildGraphFromDataset(datasetPath, token);
        
        res.json({ 
            success: true, 
            message: 'Map built successfully',
            mapFile: datasetPath.replace('dataset/playlists-', 'public/artist-map-').replace('.jsonl', '.json')
        });
    } catch (error) {
        console.error('❌ Map build failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// New endpoint to list available datasets
app.get('/api/datasets', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const path = require('path');
        
        const datasetDir = path.join(__dirname, 'dataset');
        
        try {
            const files = await fs.readdir(datasetDir);
            const datasets = files
                .filter(file => file.startsWith('playlists-') && file.endsWith('.jsonl'))
                .map(file => ({
                    name: file,
                    path: `dataset/${file}`,
                    date: file.replace('playlists-', '').replace('.jsonl', ''),
                    size: fs.stat(path.join(datasetDir, file)).then(stats => stats.size)
                }));
            
            res.json({ datasets });
        } catch (error) {
            // Dataset directory doesn't exist
            res.json({ datasets: [] });
        }
    } catch (error) {
        console.error('❌ Failed to list datasets:', error);
        res.status(500).json({ error: error.message });
    }
});

// New endpoint to list available maps
app.get('/api/maps', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const path = require('path');
        
        const publicDir = path.join(__dirname, 'public');
        
        try {
            const files = await fs.readdir(publicDir);
            const maps = files
                .filter(file => file.startsWith('artist-map-') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: `public/${file}`,
                    date: file.replace('artist-map-', '').replace('.json', ''),
                    url: `/public/${file}`
                }));
            
            res.json({ maps });
        } catch (error) {
            // Public directory doesn't exist
            res.json({ maps: [] });
        }
    } catch (error) {
        console.error('❌ Failed to list maps:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test Spotify API connection
app.get('/test-spotify', async (req, res) => {
    try {
        const token = await getAccessToken();
        const response = await axios.get('https://api.spotify.com/v1/browse/featured-playlists?limit=1', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json({ 
            success: true, 
            message: 'Spotify API connection successful',
            playlistsFound: response.data.playlists.total
        });
    } catch (error) {
        console.error('Spotify API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to connect to Spotify API' });
    }
});

// Get featured playlists
app.get('/featured-playlists', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { limit = 20, offset = 0 } = req.query;
        
        const response = await axios.get(`https://api.spotify.com/v1/browse/featured-playlists?limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Featured playlists API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch featured playlists' });
    }
});

// Get trending playlists (using new releases and charts)
app.get('/trending-playlists', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { limit = 20 } = req.query;
        
        // Get new releases
        const newReleasesResponse = await axios.get(`https://api.spotify.com/v1/browse/new-releases?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Get charts playlists (global top hits)
        const chartsResponse = await axios.get('https://api.spotify.com/v1/browse/featured-playlists?limit=10&country=US', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Combine and format the data
        const trendingData = {
            newReleases: newReleasesResponse.data.albums.items.map(album => ({
                id: album.id,
                name: album.name,
                type: 'album',
                artists: album.artists,
                images: album.images,
                release_date: album.release_date,
                category: 'new_release'
            })),
            charts: chartsResponse.data.playlists.items.map(playlist => ({
                ...playlist,
                category: 'chart'
            }))
        };

        res.json(trendingData);
    } catch (error) {
        console.error('Trending playlists API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch trending playlists' });
    }
});

// Get music categories
app.get('/categories', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { limit = 20 } = req.query;
        
        const response = await axios.get(`https://api.spotify.com/v1/browse/categories?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Categories API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get playlists by category
app.get('/category/:categoryId/playlists', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { categoryId } = req.params;
        const { limit = 20 } = req.query;
        
        const response = await axios.get(`https://api.spotify.com/v1/browse/categories/${categoryId}/playlists?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Category playlists API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch category playlists' });
    }
});

// Get comprehensive music ecosystem data
app.get('/music-ecosystem-data', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { limit = 20 } = req.query;
        
        // Get featured playlists
        const featuredResponse = await axios.get(`https://api.spotify.com/v1/browse/featured-playlists?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Get new releases
        const newReleasesResponse = await axios.get(`https://api.spotify.com/v1/browse/new-releases?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Get top categories and their playlists
        const categoriesResponse = await axios.get('https://api.spotify.com/v1/browse/categories?limit=10', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Get playlists for top categories
        const categoryPlaylists = [];
        for (const category of categoriesResponse.data.categories.items.slice(0, 5)) {
            try {
                const categoryPlaylistsResponse = await axios.get(`https://api.spotify.com/v1/browse/categories/${category.id}/playlists?limit=5`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                categoryPlaylists.push(...categoryPlaylistsResponse.data.playlists.items.map(playlist => ({
                    ...playlist,
                    category: category.name
                })));
            } catch (error) {
                console.warn(`Failed to fetch playlists for category ${category.name}:`, error.message);
            }
        }

        const ecosystemData = {
            featuredPlaylists: featuredResponse.data.playlists.items,
            newReleases: newReleasesResponse.data.albums.items,
            categoryPlaylists: categoryPlaylists,
            categories: categoriesResponse.data.categories.items,
            totalPlaylists: featuredResponse.data.playlists.items.length + categoryPlaylists.length,
            totalAlbums: newReleasesResponse.data.albums.items.length
        };

        res.json(ecosystemData);
    } catch (error) {
        console.error('Ecosystem data API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch ecosystem data' });
    }
});

// Get playlist details
app.get('/playlist/:playlistId', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { playlistId } = req.params;
        const { market, fields } = req.query;
        
        let url = `https://api.spotify.com/v1/playlists/${playlistId}`;
        const params = new URLSearchParams();
        
        if (market) params.append('market', market);
        if (fields) params.append('fields', fields);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Playlist API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch playlist' });
    }
});

// Get playlist tracks
app.get('/playlist/:playlistId/tracks', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { playlistId } = req.params;
        const { limit = 100, offset = 0 } = req.query;
        
        const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Playlist tracks API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch playlist tracks' });
    }
});

// Get available genres
app.get('/genres', async (req, res) => {
    try {
        const token = await getAccessToken();
        
        const response = await axios.get('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Genres API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

// Get track audio features
app.get('/track/:trackId/features', async (req, res) => {
    try {
        const token = await getAccessToken();
        const { trackId } = req.params;
        
        const response = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Track features API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch track features' });
    }
});

// Upload map JSON endpoint
app.post('/api/upload-map', upload.single('map'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const fs = require('fs').promises;
        const destPath = path.join(__dirname, 'public', 'artist-map.json');
        await fs.copyFile(req.file.path, destPath);
        await fs.unlink(req.file.path);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Copy map endpoint
app.post('/api/copy-map', async (req, res) => {
    try {
        const { sourceMap } = req.body;
        if (!sourceMap) return res.status(400).json({ error: 'Source map path required' });
        
        const fs = require('fs').promises;
        const path = require('path');
        
        const sourcePath = path.join(__dirname, sourceMap);
        const destPath = path.join(__dirname, 'public', 'artist-map.json');
        
        await fs.copyFile(sourcePath, destPath);
        res.json({ success: true, message: 'Map copied successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to start`);
}); 