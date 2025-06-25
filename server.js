const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Spotify configuration
const SPOTIFY_CLIENT_ID = '1b0ff5378cca441899cca8bebaf71d1a';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET; // You'll need to set this in your environment
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';

// Store tokens temporarily (in production, use a proper database)
let accessToken = null;
let refreshToken = null;

// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/visualization', (req, res) => {
    res.sendFile(__dirname + '/music-map-visualization.html');
});

// Initiate Spotify OAuth
app.get('/auth/spotify', (req, res) => {
    const scopes = [
        'user-read-private',
        'user-read-email',
        'user-top-read',
        'playlist-read-private',
        'playlist-read-collaborative'
    ];
    
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes.join(' '))}`;
    
    res.json({ authUrl });
});

// Handle OAuth callback
app.get('/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code not found' });
    }
    
    try {
        // Exchange code for tokens
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }), {
                headers: {
                    'Authorization': `Basic ${Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        
        accessToken = tokenResponse.data.access_token;
        refreshToken = tokenResponse.data.refresh_token;
        
        res.redirect('/?success=true');
    } catch (error) {
        console.error('Token exchange error:', error.response?.data || error.message);
        res.redirect('/?error=token_exchange_failed');
    }
});

// Refresh access token
app.post('/refresh-token', async (req, res) => {
    if (!refreshToken) {
        return res.status(400).json({ error: 'No refresh token available. Please authenticate first.' });
    }
    
    try {
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }), {
                headers: {
                    'Authorization': `Basic ${Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        
        accessToken = tokenResponse.data.access_token;
        if (tokenResponse.data.refresh_token) {
            refreshToken = tokenResponse.data.refresh_token;
        }
        
        res.json({ 
            success: true, 
            access_token: accessToken,
            expires_in: tokenResponse.data.expires_in
        });
    } catch (error) {
        console.error('Token refresh error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// Get current access token
app.get('/access-token', (req, res) => {
    if (!accessToken) {
        return res.status(404).json({ error: 'No access token available. Please authenticate first.' });
    }
    res.json({ access_token: accessToken });
});

// Test Spotify API endpoint
app.get('/test-spotify', async (req, res) => {
    if (!accessToken) {
        return res.status(400).json({ error: 'No access token available' });
    }
    
    try {
        const response = await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Spotify API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Get user's playlists
app.get('/user-playlists', async (req, res) => {
    if (!accessToken) {
        return res.status(400).json({ error: 'No access token available' });
    }
    
    try {
        const { limit = 20, offset = 0 } = req.query;
        const response = await axios.get(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Playlists API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

// Get playlist details (using the Get Playlist endpoint)
app.get('/playlist/:playlistId', async (req, res) => {
    if (!accessToken) {
        return res.status(400).json({ error: 'No access token available' });
    }
    
    try {
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
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Playlist API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch playlist' });
    }
});

// Get playlist tracks (using the Get Playlist Items endpoint)
app.get('/playlist/:playlistId/tracks', async (req, res) => {
    if (!accessToken) {
        return res.status(400).json({ error: 'No access token available' });
    }
    
    try {
        const { playlistId } = req.params;
        const { market, fields, limit = 20, offset = 0, additional_types } = req.query;
        
        let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
        const params = new URLSearchParams();
        
        if (market) params.append('market', market);
        if (fields) params.append('fields', fields);
        if (limit) params.append('limit', limit);
        if (offset) params.append('offset', offset);
        if (additional_types) params.append('additional_types', additional_types);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Playlist tracks API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch playlist tracks' });
    }
});

// Get available genres (for recommendations)
app.get('/genres', async (req, res) => {
    if (!accessToken) {
        return res.status(400).json({ error: 'No access token available' });
    }
    
    try {
        const response = await axios.get('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Genres API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

// Get user's top tracks
app.get('/user-top-tracks', async (req, res) => {
    if (!accessToken) {
        return res.status(400).json({ error: 'No access token available' });
    }
    
    try {
        const { time_range = 'medium_term', limit = 20, offset = 0 } = req.query;
        const response = await axios.get(`https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=${limit}&offset=${offset}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Top tracks API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch top tracks' });
    }
});

// Get track audio features
app.get('/track/:trackId/features', async (req, res) => {
    if (!accessToken) {
        return res.status(400).json({ error: 'No access token available' });
    }
    
    try {
        const { trackId } = req.params;
        const response = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Track features API error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch track features' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to start`);
}); 