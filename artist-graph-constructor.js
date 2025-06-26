// Artist Graph Constructor for Music Map
// Implements PMI (Pointwise Mutual Information) analysis between artists from playlist data

class ArtistGraphConstructor {
    constructor() {
        this.nodes = new Map(); // artist_id -> artist data
        this.edges = new Map(); // "artist1-artist2" -> edge data
        this.minEdgeWeight = 0.1; // Filter threshold for PMI (lower since PMI values are smaller)
        this.artistPlaylistCount = new Map(); // artist_id -> number of playlists they appear in
        this.totalPlaylists = 0;
        this.spotifyToken = null; // Will be set from server
    }

    /**
     * Set Spotify access token for API calls
     * @param {string} token - Spotify access token
     */
    setSpotifyToken(token) {
        this.spotifyToken = token;
    }

    /**
     * Fetch artist's top tracks and calculate average popularity
     * @param {string} artistId - Spotify artist ID
     * @returns {Promise<number>} Average popularity of top tracks
     */
    async getArtistTopTracksPopularity(artistId) {
        if (!this.spotifyToken) {
            console.warn('No Spotify token available, using fallback popularity');
            return 50; // Fallback value
        }

        try {
            const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
                headers: {
                    'Authorization': `Bearer ${this.spotifyToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.tracks || data.tracks.length === 0) {
                return 0;
            }

            // Calculate average popularity of top tracks
            const totalPopularity = data.tracks.reduce((sum, track) => sum + (track.popularity || 0), 0);
            const averagePopularity = totalPopularity / data.tracks.length;
            
            return averagePopularity;
        } catch (error) {
            console.warn(`Failed to fetch top tracks for artist ${artistId}:`, error.message);
            return 50; // Fallback value
        }
    }

    /**
     * Process playlists and build the artist graph using PMI
     * @param {Array} playlists - Array of playlist objects from Spotify API
     */
    async buildGraphFromPlaylists(playlists) {
        console.log('🎵 Building artist graph using PMI analysis...');
        
        // Reset graph
        this.nodes.clear();
        this.edges.clear();
        this.artistPlaylistCount.clear();
        this.totalPlaylists = playlists.length;

        // First pass: collect artist statistics and playlist appearances
        this.collectArtistStatistics(playlists);

        // Second pass: calculate PMI for artist pairs
        this.calculatePMI(playlists);

        // Third pass: fetch top tracks popularity for each artist
        await this.fetchArtistPopularities();

        // Calculate artist statistics
        this.calculateArtistStatistics();

        // Filter edges and finalize graph
        this.filterEdges();
        
        const graphData = this.getGraphData();
        console.log(`✅ PMI-based artist graph built: ${graphData.nodes.length} artists, ${graphData.edges.length} connections`);
        
        return graphData;
    }

    /**
     * Fetch top tracks popularity for all artists
     */
    async fetchArtistPopularities() {
        console.log('📊 Fetching artist top tracks popularity...');
        const artistIds = Array.from(this.nodes.keys());
        
        // Process artists in batches to avoid rate limiting
        const batchSize = 5;
        for (let i = 0; i < artistIds.length; i += batchSize) {
            const batch = artistIds.slice(i, i + batchSize);
            
            // Fetch popularity for batch
            const promises = batch.map(async (artistId) => {
                const popularity = await this.getArtistTopTracksPopularity(artistId);
                const artist = this.nodes.get(artistId);
                if (artist) {
                    artist.topTracksPopularity = popularity;
                }
            });
            
            await Promise.all(promises);
            
            // Rate limiting delay
            if (i + batchSize < artistIds.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        console.log('✅ Finished fetching artist popularities');
    }

    /**
     * Collect artist statistics and playlist appearances
     * @param {Array} playlists - Array of playlist objects
     */
    collectArtistStatistics(playlists) {
        playlists.forEach(playlist => {
            if (!playlist.tracks || !playlist.tracks.items) {
                return;
            }

            const tracks = playlist.tracks.items
                .filter(item => item.track && item.track.id)
                .map(item => item.track);

            // Get unique artists in this playlist
            const playlistArtists = new Set();
            tracks.forEach(track => {
                track.artists.forEach(artist => {
                    playlistArtists.add(artist.id);
                    this.addArtist(artist, track);
                });
            });

            // Count playlist appearances for each artist
            playlistArtists.forEach(artistId => {
                this.artistPlaylistCount.set(artistId, 
                    (this.artistPlaylistCount.get(artistId) || 0) + 1);
            });
        });
    }

    /**
     * Calculate PMI for all artist pairs
     * @param {Array} playlists - Array of playlist objects
     */
    calculatePMI(playlists) {
        playlists.forEach(playlist => {
            if (!playlist.tracks || !playlist.tracks.items) {
                return;
            }

            const tracks = playlist.tracks.items
                .filter(item => item.track && item.track.id)
                .map(item => item.track);

            // Get unique artists in this playlist
            const playlistArtists = new Set();
            tracks.forEach(track => {
                track.artists.forEach(artist => {
                    playlistArtists.add(artist.id);
                });
            });

            // Calculate PMI for all pairs in this playlist
            const artistArray = Array.from(playlistArtists);
            for (let i = 0; i < artistArray.length; i++) {
                for (let j = i + 1; j < artistArray.length; j++) {
                    this.calculatePairPMI(artistArray[i], artistArray[j], playlist);
                }
            }
        });
    }

    /**
     * Calculate PMI for a specific artist pair
     * @param {string} artist1Id - First artist ID
     * @param {string} artist2Id - Second artist ID
     * @param {Object} playlist - Playlist where they co-occur
     */
    calculatePairPMI(artist1Id, artist2Id, playlist) {
        // Ensure consistent ordering for edge key
        const [id1, id2] = [artist1Id, artist2Id].sort();
        const edgeKey = `${id1}-${id2}`;

        // Get individual probabilities
        const p1 = this.artistPlaylistCount.get(id1) / this.totalPlaylists;
        const p2 = this.artistPlaylistCount.get(id2) / this.totalPlaylists;

        // Update joint probability (co-occurrence count)
        if (this.edges.has(edgeKey)) {
            const edge = this.edges.get(edgeKey);
            edge.jointCount += 1;
            edge.playlists.push({
                id: playlist.id,
                name: playlist.name,
                category: playlist.category
            });
        } else {
            this.edges.set(edgeKey, {
                source: id1,
                target: id2,
                jointCount: 1,
                p1: p1,
                p2: p2,
                playlists: [{
                    id: playlist.id,
                    name: playlist.name,
                    category: playlist.category
                }]
            });
        }
    }

    /**
     * Add an artist as a node in the graph
     * @param {Object} artist - Artist object from Spotify API
     * @param {Object} track - Track object for additional data
     */
    addArtist(artist, track) {
        if (this.nodes.has(artist.id)) {
            // Update existing artist with additional track info
            const existingArtist = this.nodes.get(artist.id);
            existingArtist.trackCount += 1;
            existingArtist.totalPopularity += track.popularity || 0;
            
            // Update release year range
            const releaseYear = this.extractReleaseYear(track.album.release_date);
            existingArtist.releaseYears.add(releaseYear);
            
            return;
        }

        // Create new artist node
        const releaseYear = this.extractReleaseYear(track.album.release_date);
        const node = {
            id: artist.id,
            name: artist.name,
            spotifyUrl: artist.external_urls.spotify,
            // Track statistics
            trackCount: 1,
            totalPopularity: track.popularity || 0,
            releaseYears: new Set([releaseYear]),
            // Top tracks popularity (will be fetched later)
            topTracksPopularity: null,
            // Visual properties (will be calculated later)
            size: 0,
            color: ''
        };

        this.nodes.set(artist.id, node);
    }

    /**
     * Extract release year from Spotify release_date
     * @param {string} releaseDate - Date string from Spotify API
     * @returns {number} Release year
     */
    extractReleaseYear(releaseDate) {
        if (!releaseDate) return 2000;
        
        // Spotify release_date can be "YYYY", "YYYY-MM", or "YYYY-MM-DD"
        const year = parseInt(releaseDate.split('-')[0]);
        return isNaN(year) ? 2000 : year;
    }

    /**
     * Calculate PMI values for all edges and filter
     */
    calculateArtistStatistics() {
        // Calculate PMI for all edges
        this.edges.forEach((edge, edgeKey) => {
            const jointProb = edge.jointCount / this.totalPlaylists;
            const expectedProb = edge.p1 * edge.p2;
            
            // Calculate PMI: log(P(A,B) / (P(A) * P(B)))
            const pmi = Math.log(jointProb / expectedProb);
            
            // Only keep positive PMI values (indicating positive association)
            if (pmi > 0) {
                edge.weight = pmi;
                edge.jointProb = jointProb;
                edge.expectedProb = expectedProb;
            } else {
                // Remove edges with negative PMI
                this.edges.delete(edgeKey);
            }
        });

        // Calculate node properties
        this.nodes.forEach((artist, artistId) => {
            // Use top tracks popularity if available, otherwise fallback to playlist average
            const popularity = artist.topTracksPopularity !== null ? 
                artist.topTracksPopularity : 
                (artist.totalPopularity / artist.trackCount);
            
            // Calculate dominant release era
            const releaseYears = Array.from(artist.releaseYears);
            const avgReleaseYear = releaseYears.reduce((sum, year) => sum + year, 0) / releaseYears.length;
            
            // Update artist with calculated properties
            artist.avgPopularity = Math.round(popularity);
            artist.avgReleaseYear = Math.round(avgReleaseYear);
            artist.playlistCount = this.artistPlaylistCount.get(artistId) || 0;
            
            // Calculate visual properties
            artist.size = this.calculateArtistSize(artist.trackCount, popularity, artist.playlistCount);
            artist.color = this.calculateArtistColor(avgReleaseYear);
        });
    }

    /**
     * Calculate artist node size based on top tracks popularity
     * @param {number} trackCount - Number of tracks by this artist
     * @param {number} topTracksPopularity - Average popularity of top tracks (0-100)
     * @param {number} playlistCount - Number of playlists this artist appears in
     * @returns {number} Node size for visualization
     */
    calculateArtistSize(trackCount, topTracksPopularity, playlistCount) {
        // Size is primarily based on top tracks popularity (0-100)
        const popularityScore = topTracksPopularity * 0.6; // 60% weight
        const playlistScore = Math.log(playlistCount + 1) * 2; // 20% weight
        const trackScore = Math.log(trackCount + 1) * 1; // 20% weight
        
        const totalScore = popularityScore + playlistScore + trackScore;
        
        return Math.max(15, Math.min(80, totalScore));
    }

    /**
     * Calculate artist node color based on average release year
     * @param {number} avgReleaseYear - Average release year of tracks
     * @returns {string} Color hex code
     */
    calculateArtistColor(avgReleaseYear) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - avgReleaseYear;
        
        // Color gradient: newer = blue, older = red
        const normalizedAge = Math.min(age / 50, 1);
        return `rgb(${Math.round(255 * normalizedAge)}, 100, ${Math.round(255 * (1 - normalizedAge))})`;
    }

    /**
     * Filter edges based on minimum PMI threshold
     */
    filterEdges() {
        const filteredEdges = new Map();
        
        this.edges.forEach((edge, edgeKey) => {
            if (edge.weight >= this.minEdgeWeight) {
                filteredEdges.set(edgeKey, edge);
            }
        });
        
        this.edges = filteredEdges;
        console.log(`Filtered edges: ${this.edges.size} edges with PMI >= ${this.minEdgeWeight}`);
    }

    /**
     * Get the final graph data for visualization
     * @returns {Object} Graph data with nodes and edges
     */
    getGraphData() {
        const nodes = Array.from(this.nodes.values()).map(node => ({
            data: {
                ...node,
                releaseYears: Array.from(node.releaseYears)
            }
        }));

        const edges = Array.from(this.edges.values()).map(edge => ({
            data: {
                ...edge,
                id: `${edge.source}-${edge.target}`,
                thickness: this.calculateEdgeThickness(edge.weight)
            }
        }));

        return { nodes, edges };
    }

    /**
     * Calculate edge thickness based on PMI weight
     * @param {number} weight - PMI weight value
     * @returns {number} Edge thickness for visualization
     */
    calculateEdgeThickness(weight) {
        // PMI values are typically small, so scale appropriately
        return Math.max(1, Math.min(15, weight * 5));
    }

    /**
     * Get graph statistics
     * @returns {Object} Statistics about the graph
     */
    getGraphStats() {
        const artists = this.nodes.size;
        const connections = this.edges.size;
        
        const popularities = Array.from(this.nodes.values()).map(n => n.avgPopularity);
        const releaseYears = Array.from(this.nodes.values()).map(n => n.avgReleaseYear);
        const connectionWeights = Array.from(this.edges.values()).map(e => e.weight);
        
        return {
            artists,
            connections,
            popularity: {
                avg: popularities.reduce((a, b) => a + b, 0) / popularities.length,
                min: Math.min(...popularities),
                max: Math.max(...popularities)
            },
            releaseYears: {
                avg: releaseYears.reduce((a, b) => a + b, 0) / releaseYears.length,
                min: Math.min(...releaseYears),
                max: Math.max(...releaseYears)
            },
            connectionWeights: {
                avg: connectionWeights.reduce((a, b) => a + b, 0) / connectionWeights.length,
                min: Math.min(...connectionWeights),
                max: Math.max(...connectionWeights)
            }
        };
    }

    /**
     * Export graph to JSON file
     * @param {string} filename - Output filename
     */
    exportToJSON(filename = 'artist-graph-pmi.json') {
        const fs = require('fs');
        const graphData = this.getGraphData();
        const stats = this.getGraphStats();
        
        const exportData = {
            metadata: {
                generatedAt: new Date().toISOString(),
                method: 'PMI (Pointwise Mutual Information)',
                popularitySource: 'Artist Top Tracks',
                minEdgeWeight: this.minEdgeWeight,
                totalPlaylists: this.totalPlaylists,
                stats: stats
            },
            graph: graphData
        };
        
        fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        console.log(`✅ PMI-based graph exported to ${filename}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArtistGraphConstructor;
} 