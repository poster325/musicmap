// Music Ecosystem Data Collector
// Analyzes the broader Spotify ecosystem for unbiased music mapping

const axios = require('axios');

class MusicEcosystemCollector {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.accessToken = null;
        this.collectedData = {
            playlists: [],
            tracks: [],
            artists: [],
            albums: [],
            categories: [],
            genres: [],
            metadata: {
                collectedAt: new Date().toISOString(),
                totalPlaylists: 0,
                totalTracks: 0,
                totalArtists: 0,
                totalAlbums: 0
            }
        };
    }

    /**
     * Set access token for API calls
     */
    setAccessToken(token) {
        this.accessToken = token;
    }

    /**
     * Collect comprehensive ecosystem data
     */
    async collectEcosystemData() {
        console.log('🌍 Starting Music Ecosystem Data Collection...\n');

        try {
            // 1. Get categories
            console.log('📂 Fetching music categories...');
            await this.collectCategories();

            // 2. Get featured playlists
            console.log('⭐ Fetching featured playlists...');
            await this.collectFeaturedPlaylists();

            // 3. Get trending playlists
            console.log('🔥 Fetching trending playlists...');
            await this.collectTrendingPlaylists();

            // 4. Get new releases
            console.log('🆕 Fetching new releases...');
            await this.collectNewReleases();

            // 5. Get category playlists
            console.log('🎼 Fetching category playlists...');
            await this.collectCategoryPlaylists();

            // 6. Process and analyze data
            console.log('📊 Processing collected data...');
            this.processCollectedData();

            console.log('✅ Ecosystem data collection completed!');
            return this.collectedData;

        } catch (error) {
            console.error('❌ Error collecting ecosystem data:', error.message);
            throw error;
        }
    }

    /**
     * Collect music categories
     */
    async collectCategories() {
        try {
            const response = await axios.get(`${this.baseUrl}/categories?limit=50`);
            this.collectedData.categories = response.data.categories.items;
            console.log(`  ✅ Found ${this.collectedData.categories.length} categories`);
        } catch (error) {
            console.error('  ❌ Failed to fetch categories:', error.message);
        }
    }

    /**
     * Collect featured playlists
     */
    async collectFeaturedPlaylists() {
        try {
            const response = await axios.get(`${this.baseUrl}/featured-playlists?limit=50`);
            const playlists = response.data.playlists.items;
            
            // Get detailed track data for each playlist
            for (const playlist of playlists.slice(0, 20)) { // Limit to prevent rate limiting
                try {
                    const tracksResponse = await axios.get(`${this.baseUrl}/playlist/${playlist.id}/tracks?limit=100`);
                    if (tracksResponse.data.items) {
                        playlist.tracks = tracksResponse.data;
                        this.collectedData.playlists.push(playlist);
                        this.extractTracksFromPlaylist(playlist);
                    }
                } catch (error) {
                    console.warn(`    ⚠️ Failed to fetch tracks for playlist ${playlist.name}`);
                }
            }
            
            console.log(`  ✅ Processed ${this.collectedData.playlists.length} featured playlists`);
        } catch (error) {
            console.error('  ❌ Failed to fetch featured playlists:', error.message);
        }
    }

    /**
     * Collect trending playlists
     */
    async collectTrendingPlaylists() {
        try {
            const response = await axios.get(`${this.baseUrl}/trending-playlists`);
            const playlists = response.data.playlists;
            
            for (const playlist of playlists) {
                try {
                    const tracksResponse = await axios.get(`${this.baseUrl}/playlist/${playlist.id}/tracks?limit=100`);
                    if (tracksResponse.data.items) {
                        playlist.tracks = tracksResponse.data;
                        this.collectedData.playlists.push(playlist);
                        this.extractTracksFromPlaylist(playlist);
                    }
                } catch (error) {
                    console.warn(`    ⚠️ Failed to fetch tracks for trending playlist ${playlist.name}`);
                }
            }
            
            console.log(`  ✅ Processed ${playlists.length} trending playlists`);
        } catch (error) {
            console.error('  ❌ Failed to fetch trending playlists:', error.message);
        }
    }

    /**
     * Collect new releases
     */
    async collectNewReleases() {
        try {
            const response = await axios.get(`${this.baseUrl}/new-releases?limit=50`);
            const albums = response.data.albums.items;
            
            // Extract tracks from new releases
            for (const album of albums) {
                if (album.tracks && album.tracks.items) {
                    for (const track of album.tracks.items) {
                        this.addTrack(track, album);
                    }
                }
            }
            
            console.log(`  ✅ Processed ${albums.length} new releases`);
        } catch (error) {
            console.error('  ❌ Failed to fetch new releases:', error.message);
        }
    }

    /**
     * Collect playlists from top categories
     */
    async collectCategoryPlaylists() {
        const topCategories = this.collectedData.categories.slice(0, 10); // Top 10 categories
        
        for (const category of topCategories) {
            try {
                const response = await axios.get(`${this.baseUrl}/category-playlists/${category.id}?limit=10`);
                const playlists = response.data.playlists.items;
                
                for (const playlist of playlists.slice(0, 5)) { // Limit per category
                    try {
                        const tracksResponse = await axios.get(`${this.baseUrl}/playlist/${playlist.id}/tracks?limit=100`);
                        if (tracksResponse.data.items) {
                            playlist.tracks = tracksResponse.data;
                            playlist.category = category.name;
                            this.collectedData.playlists.push(playlist);
                            this.extractTracksFromPlaylist(playlist);
                        }
                    } catch (error) {
                        console.warn(`    ⚠️ Failed to fetch tracks for category playlist ${playlist.name}`);
                    }
                }
                
                console.log(`  ✅ Processed ${playlists.length} playlists from category: ${category.name}`);
            } catch (error) {
                console.warn(`  ⚠️ Failed to fetch playlists for category ${category.name}:`, error.message);
            }
        }
    }

    /**
     * Extract tracks from a playlist
     */
    extractTracksFromPlaylist(playlist) {
        if (!playlist.tracks || !playlist.tracks.items) return;
        
        for (const item of playlist.tracks.items) {
            if (item.track) {
                this.addTrack(item.track, item.track.album, playlist);
            }
        }
    }

    /**
     * Add a track to the collection
     */
    addTrack(track, album, playlist = null) {
        // Check if track already exists
        const existingTrack = this.collectedData.tracks.find(t => t.id === track.id);
        if (existingTrack) {
            // Update co-occurrence data
            if (playlist) {
                existingTrack.playlists.push({
                    id: playlist.id,
                    name: playlist.name,
                    category: playlist.category
                });
            }
            return;
        }

        // Add new track
        const trackData = {
            id: track.id,
            name: track.name,
            artists: track.artists.map(artist => ({
                id: artist.id,
                name: artist.name
            })),
            album: {
                id: album.id,
                name: album.name,
                release_date: album.release_date,
                images: album.images
            },
            duration_ms: track.duration_ms,
            popularity: track.popularity,
            explicit: track.explicit,
            spotify_url: track.external_urls.spotify,
            preview_url: track.preview_url,
            playlists: playlist ? [{
                id: playlist.id,
                name: playlist.name,
                category: playlist.category
            }] : []
        };

        this.collectedData.tracks.push(trackData);

        // Add artists
        for (const artist of track.artists) {
            this.addArtist(artist);
        }

        // Add album
        this.addAlbum(album);
    }

    /**
     * Add an artist to the collection
     */
    addArtist(artist) {
        const existingArtist = this.collectedData.artists.find(a => a.id === artist.id);
        if (!existingArtist) {
            this.collectedData.artists.push({
                id: artist.id,
                name: artist.name,
                spotify_url: artist.external_urls.spotify
            });
        }
    }

    /**
     * Add an album to the collection
     */
    addAlbum(album) {
        const existingAlbum = this.collectedData.albums.find(a => a.id === album.id);
        if (!existingAlbum) {
            this.collectedData.albums.push({
                id: album.id,
                name: album.name,
                release_date: album.release_date,
                images: album.images,
                artists: album.artists.map(artist => ({
                    id: artist.id,
                    name: artist.name
                }))
            });
        }
    }

    /**
     * Process and analyze collected data
     */
    processCollectedData() {
        // Update metadata
        this.collectedData.metadata.totalPlaylists = this.collectedData.playlists.length;
        this.collectedData.metadata.totalTracks = this.collectedData.tracks.length;
        this.collectedData.metadata.totalArtists = this.collectedData.artists.length;
        this.collectedData.metadata.totalAlbums = this.collectedData.albums.length;

        // Calculate statistics
        this.collectedData.statistics = this.calculateStatistics();

        console.log(`📊 Collection Summary:`);
        console.log(`  - Playlists: ${this.collectedData.metadata.totalPlaylists}`);
        console.log(`  - Tracks: ${this.collectedData.metadata.totalTracks}`);
        console.log(`  - Artists: ${this.collectedData.metadata.totalArtists}`);
        console.log(`  - Albums: ${this.collectedData.metadata.totalAlbums}`);
        console.log(`  - Categories: ${this.collectedData.categories.length}`);
    }

    /**
     * Calculate statistics from collected data
     */
    calculateStatistics() {
        const tracks = this.collectedData.tracks;
        
        // Popularity statistics
        const popularities = tracks.map(t => t.popularity).filter(p => p !== null);
        const popularityStats = {
            min: Math.min(...popularities),
            max: Math.max(...popularities),
            avg: popularities.reduce((sum, p) => sum + p, 0) / popularities.length
        };

        // Release year statistics
        const years = tracks.map(t => {
            const year = parseInt(t.album.release_date.split('-')[0]);
            return isNaN(year) ? 2000 : year;
        });
        const yearStats = {
            min: Math.min(...years),
            max: Math.max(...years),
            avg: years.reduce((sum, y) => sum + y, 0) / years.length
        };

        // Genre distribution (from categories)
        const categoryCounts = {};
        this.collectedData.playlists.forEach(playlist => {
            if (playlist.category) {
                categoryCounts[playlist.category] = (categoryCounts[playlist.category] || 0) + 1;
            }
        });

        return {
            popularity: popularityStats,
            releaseYears: yearStats,
            categoryDistribution: categoryCounts
        };
    }

    /**
     * Export collected data to JSON file
     */
    exportToJSON(filename = 'music-ecosystem-data.json') {
        const fs = require('fs');
        const dataStr = JSON.stringify(this.collectedData, null, 2);
        
        fs.writeFileSync(filename, dataStr);
        console.log(`💾 Ecosystem data exported to ${filename}`);
        
        return filename;
    }

    /**
     * Generate co-occurrence matrix for graph construction
     */
    generateCoOccurrenceMatrix() {
        console.log('🔗 Generating co-occurrence matrix...');
        
        const coOccurrences = new Map();
        const trackIds = this.collectedData.tracks.map(t => t.id);
        
        // Initialize co-occurrence matrix
        for (let i = 0; i < trackIds.length; i++) {
            for (let j = i + 1; j < trackIds.length; j++) {
                const key = `${trackIds[i]}-${trackIds[j]}`;
                coOccurrences.set(key, 0);
            }
        }

        // Count co-occurrences in playlists
        this.collectedData.playlists.forEach(playlist => {
            if (playlist.tracks && playlist.tracks.items) {
                const playlistTrackIds = playlist.tracks.items
                    .map(item => item.track?.id)
                    .filter(id => id);
                
                // Count all pairs
                for (let i = 0; i < playlistTrackIds.length; i++) {
                    for (let j = i + 1; j < playlistTrackIds.length; j++) {
                        const [id1, id2] = [playlistTrackIds[i], playlistTrackIds[j]].sort();
                        const key = `${id1}-${id2}`;
                        coOccurrences.set(key, (coOccurrences.get(key) || 0) + 1);
                    }
                }
            }
        });

        // Filter significant co-occurrences
        const significantCoOccurrences = Array.from(coOccurrences.entries())
            .filter(([key, count]) => count >= 2) // Minimum 2 shared playlists
            .map(([key, count]) => {
                const [track1Id, track2Id] = key.split('-');
                return {
                    track1: track1Id,
                    track2: track2Id,
                    weight: count
                };
            });

        console.log(`✅ Generated ${significantCoOccurrences.length} significant co-occurrences`);
        
        return {
            coOccurrences: significantCoOccurrences,
            totalTracks: trackIds.length,
            totalPlaylists: this.collectedData.playlists.length
        };
    }
}

// Example usage
async function runEcosystemCollection() {
    console.log('🎵 Music Ecosystem Data Collection\n');
    
    const collector = new MusicEcosystemCollector();
    
    try {
        // You would need to get an access token first
        // collector.setAccessToken('your_access_token_here');
        
        // Collect ecosystem data
        const data = await collector.collectEcosystemData();
        
        // Generate co-occurrence matrix
        const coOccurrenceData = collector.generateCoOccurrenceMatrix();
        
        // Export data
        collector.exportToJSON();
        
        console.log('\n🎉 Ecosystem data collection completed successfully!');
        
    } catch (error) {
        console.error('❌ Collection failed:', error.message);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicEcosystemCollector;
}

// Run if called directly
if (require.main === module) {
    runEcosystemCollection();
} 