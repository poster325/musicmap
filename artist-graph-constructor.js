// Artist Graph Constructor for Music Map
// Implements co-occurrence analysis between artists from playlist data

class ArtistGraphConstructor {
    constructor() {
        this.nodes = new Map(); // artist_id -> artist data
        this.edges = new Map(); // "artist1-artist2" -> edge data
        this.minEdgeWeight = 3; // Filter threshold (lower for artists)
    }

    /**
     * Process playlists and build the artist graph
     * @param {Array} playlists - Array of playlist objects from Spotify API
     */
    buildGraphFromPlaylists(playlists) {
        console.log('🎵 Building artist graph from playlists...');
        
        // Reset graph
        this.nodes.clear();
        this.edges.clear();

        // Process each playlist
        playlists.forEach(playlist => {
            this.processPlaylist(playlist);
        });

        // Calculate artist statistics
        this.calculateArtistStatistics();

        // Filter edges and finalize graph
        this.filterEdges();
        
        const graphData = this.getGraphData();
        console.log(`✅ Artist graph built: ${graphData.nodes.length} artists, ${graphData.edges.length} connections`);
        
        return graphData;
    }

    /**
     * Process a single playlist to extract artist co-occurrences
     * @param {Object} playlist - Playlist object with tracks
     */
    processPlaylist(playlist) {
        if (!playlist.tracks || !playlist.tracks.items) {
            return;
        }

        const tracks = playlist.tracks.items
            .filter(item => item.track && item.track.id) // Filter out null tracks
            .map(item => item.track);

        // Extract unique artists from this playlist
        const playlistArtists = new Set();
        tracks.forEach(track => {
            track.artists.forEach(artist => {
                playlistArtists.add(artist.id);
                this.addArtist(artist, track);
            });
        });

        // Create co-occurrence pairs between artists in this playlist
        const artistArray = Array.from(playlistArtists);
        for (let i = 0; i < artistArray.length; i++) {
            for (let j = i + 1; j < artistArray.length; j++) {
                this.addCoOccurrence(artistArray[i], artistArray[j], playlist);
            }
        }
    }

    /**
     * Add or update co-occurrence between two artists
     * @param {string} artist1Id - First artist ID
     * @param {string} artist2Id - Second artist ID
     * @param {Object} playlist - Playlist where they co-occur
     */
    addCoOccurrence(artist1Id, artist2Id, playlist) {
        // Ensure consistent ordering for edge key
        const [id1, id2] = [artist1Id, artist2Id].sort();
        const edgeKey = `${id1}-${id2}`;

        // Update edge weight
        if (this.edges.has(edgeKey)) {
            const edge = this.edges.get(edgeKey);
            edge.weight += 1;
            edge.playlists.push({
                id: playlist.id,
                name: playlist.name,
                category: playlist.category
            });
        } else {
            this.edges.set(edgeKey, {
                source: id1,
                target: id2,
                weight: 1,
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
     * Calculate statistics for each artist
     */
    calculateArtistStatistics() {
        this.nodes.forEach((artist, artistId) => {
            // Calculate average popularity
            const avgPopularity = artist.totalPopularity / artist.trackCount;
            
            // Calculate dominant release era
            const releaseYears = Array.from(artist.releaseYears);
            const avgReleaseYear = releaseYears.reduce((sum, year) => sum + year, 0) / releaseYears.length;
            
            // Update artist with calculated properties
            artist.avgPopularity = Math.round(avgPopularity);
            artist.avgReleaseYear = Math.round(avgReleaseYear);
            
            // Calculate visual properties
            artist.size = this.calculateArtistSize(artist.trackCount, avgPopularity);
            artist.color = this.calculateArtistColor(avgReleaseYear);
        });
    }

    /**
     * Calculate artist node size based on track count and popularity
     * @param {number} trackCount - Number of tracks by this artist
     * @param {number} avgPopularity - Average popularity of tracks
     * @returns {number} Node size for visualization
     */
    calculateArtistSize(trackCount, avgPopularity) {
        // Combine track count and popularity for size
        const trackScore = Math.log(trackCount + 1) * 5;
        const popularityScore = avgPopularity * 0.3;
        const totalScore = trackScore + popularityScore;
        
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
        const normalizedAge = Math.min(age / 50, 1); // Normalize to 0-1 for 50 years
        
        // Blue to red gradient
        const r = Math.round(255 * normalizedAge);
        const g = Math.round(100);
        const b = Math.round(255 * (1 - normalizedAge));
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Filter edges based on minimum weight threshold
     */
    filterEdges() {
        const filteredEdges = new Map();
        
        for (const [key, edge] of this.edges) {
            if (edge.weight >= this.minEdgeWeight) {
                filteredEdges.set(key, edge);
            }
        }
        
        this.edges = filteredEdges;
        console.log(`🔍 Filtered edges: ${filteredEdges.size} connections with weight >= ${this.minEdgeWeight}`);
    }

    /**
     * Get the final graph data in Cytoscape.js format
     * @returns {Object} Graph data with nodes and edges
     */
    getGraphData() {
        const nodes = Array.from(this.nodes.values()).map(artist => ({
            data: {
                id: artist.id,
                name: artist.name,
                spotifyUrl: artist.spotifyUrl,
                trackCount: artist.trackCount,
                avgPopularity: artist.avgPopularity,
                avgReleaseYear: artist.avgReleaseYear,
                size: artist.size,
                color: artist.color
            }
        }));

        const edges = Array.from(this.edges.values()).map(edge => ({
            data: {
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                weight: edge.weight,
                thickness: this.calculateEdgeThickness(edge.weight),
                playlists: edge.playlists.length
            }
        }));

        return { nodes, edges };
    }

    /**
     * Calculate edge thickness based on weight
     * @param {number} weight - Edge weight (co-occurrence count)
     * @returns {number} Edge thickness for visualization
     */
    calculateEdgeThickness(weight) {
        // Map weight to thickness (1-15)
        return Math.max(1, Math.min(15, Math.log(weight + 1) * 3));
    }

    /**
     * Get graph statistics
     * @returns {Object} Statistics about the artist graph
     */
    getGraphStats() {
        const nodes = Array.from(this.nodes.values());
        const edges = Array.from(this.edges.values());
        
        const popularityStats = {
            min: Math.min(...nodes.map(n => n.avgPopularity)),
            max: Math.max(...nodes.map(n => n.avgPopularity)),
            avg: nodes.reduce((sum, n) => sum + n.avgPopularity, 0) / nodes.length
        };

        const yearStats = {
            min: Math.min(...nodes.map(n => n.avgReleaseYear)),
            max: Math.max(...nodes.map(n => n.avgReleaseYear)),
            avg: nodes.reduce((sum, n) => sum + n.avgReleaseYear, 0) / nodes.length
        };

        const weightStats = {
            min: Math.min(...edges.map(e => e.weight)),
            max: Math.max(...edges.map(e => e.weight)),
            avg: edges.reduce((sum, e) => sum + e.weight, 0) / edges.length
        };

        return {
            artists: nodes.length,
            connections: edges.length,
            popularity: popularityStats,
            releaseYears: yearStats,
            connectionWeights: weightStats
        };
    }

    /**
     * Export graph data to JSON file
     * @param {string} filename - Output filename
     */
    exportToJSON(filename = 'artist-graph.json') {
        const graphData = this.getGraphData();
        const stats = this.getGraphStats();
        
        const exportData = {
            metadata: {
                generatedAt: new Date().toISOString(),
                minEdgeWeight: this.minEdgeWeight,
                stats: stats
            },
            graph: graphData
        };

        // In a browser environment, trigger download
        if (typeof window !== 'undefined') {
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            
            URL.revokeObjectURL(url);
        }

        return exportData;
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArtistGraphConstructor;
}

// Export for browser
if (typeof window !== 'undefined') {
    window.ArtistGraphConstructor = ArtistGraphConstructor;
} 