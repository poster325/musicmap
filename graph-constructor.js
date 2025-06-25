// Graph Constructor for Music Map
// Implements co-occurrence analysis and graph building from playlist data

class MusicGraphConstructor {
    constructor() {
        this.nodes = new Map(); // track_id -> node data
        this.edges = new Map(); // "track1-track2" -> edge data
        this.minEdgeWeight = 10; // Filter threshold
    }

    /**
     * Process playlists and build the music graph
     * @param {Array} playlists - Array of playlist objects from Spotify API
     */
    buildGraphFromPlaylists(playlists) {
        console.log('🎵 Building music graph from playlists...');
        
        // Reset graph
        this.nodes.clear();
        this.edges.clear();

        // Process each playlist
        playlists.forEach(playlist => {
            this.processPlaylist(playlist);
        });

        // Filter edges and finalize graph
        this.filterEdges();
        
        const graphData = this.getGraphData();
        console.log(`✅ Graph built: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
        
        return graphData;
    }

    /**
     * Process a single playlist to extract co-occurrences
     * @param {Object} playlist - Playlist object with tracks
     */
    processPlaylist(playlist) {
        if (!playlist.tracks || !playlist.tracks.items) {
            return;
        }

        const tracks = playlist.tracks.items
            .filter(item => item.track && item.track.id) // Filter out null tracks
            .map(item => item.track);

        // Create co-occurrence pairs
        for (let i = 0; i < tracks.length; i++) {
            for (let j = i + 1; j < tracks.length; j++) {
                this.addCoOccurrence(tracks[i], tracks[j]);
            }
        }
    }

    /**
     * Add or update co-occurrence between two tracks
     * @param {Object} track1 - First track object
     * @param {Object} track2 - Second track object
     */
    addCoOccurrence(track1, track2) {
        // Ensure consistent ordering for edge key
        const [id1, id2] = [track1.id, track2.id].sort();
        const edgeKey = `${id1}-${id2}`;

        // Add nodes if they don't exist
        this.addNode(track1);
        this.addNode(track2);

        // Update edge weight
        if (this.edges.has(edgeKey)) {
            this.edges.get(edgeKey).weight += 1;
        } else {
            this.edges.set(edgeKey, {
                source: id1,
                target: id2,
                weight: 1,
                tracks: [track1, track2]
            });
        }
    }

    /**
     * Add a track as a node in the graph
     * @param {Object} track - Track object from Spotify API
     */
    addNode(track) {
        if (this.nodes.has(track.id)) {
            return; // Node already exists
        }

        // Extract release year from release_date
        const releaseYear = this.extractReleaseYear(track.album.release_date);
        
        // Calculate node properties
        const node = {
            id: track.id,
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            artistIds: track.artists.map(a => a.id),
            album: track.album.name,
            albumId: track.album.id,
            popularity: track.popularity || 0,
            releaseYear: releaseYear,
            duration: track.duration_ms,
            spotifyUrl: track.external_urls.spotify,
            previewUrl: track.preview_url,
            // Visual properties
            size: this.calculateNodeSize(track.popularity),
            color: this.calculateNodeColor(releaseYear),
            // Additional metadata
            genres: [], // Will be populated later if needed
            audioFeatures: null // Will be populated later if needed
        };

        this.nodes.set(track.id, node);
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
     * Calculate node size based on popularity
     * @param {number} popularity - Spotify popularity score (0-100)
     * @returns {number} Node size for visualization
     */
    calculateNodeSize(popularity) {
        // Map popularity (0-100) to size (10-50)
        return Math.max(10, Math.min(50, 10 + (popularity * 0.4)));
    }

    /**
     * Calculate node color based on release year
     * @param {number} releaseYear - Year the track was released
     * @returns {string} Color hex code
     */
    calculateNodeColor(releaseYear) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - releaseYear;
        
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
        console.log(`🔍 Filtered edges: ${filteredEdges.size} edges with weight >= ${this.minEdgeWeight}`);
    }

    /**
     * Get the final graph data in Cytoscape.js format
     * @returns {Object} Graph data with nodes and edges
     */
    getGraphData() {
        const nodes = Array.from(this.nodes.values()).map(node => ({
            data: {
                id: node.id,
                name: node.name,
                artist: node.artist,
                album: node.album,
                popularity: node.popularity,
                releaseYear: node.releaseYear,
                spotifyUrl: node.spotifyUrl,
                previewUrl: node.previewUrl,
                size: node.size,
                color: node.color
            }
        }));

        const edges = Array.from(this.edges.values()).map(edge => ({
            data: {
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                weight: edge.weight,
                thickness: this.calculateEdgeThickness(edge.weight)
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
        // Map weight to thickness (1-10)
        return Math.max(1, Math.min(10, Math.log(weight + 1) * 2));
    }

    /**
     * Get graph statistics
     * @returns {Object} Statistics about the graph
     */
    getGraphStats() {
        const nodes = Array.from(this.nodes.values());
        const edges = Array.from(this.edges.values());
        
        const popularityStats = {
            min: Math.min(...nodes.map(n => n.popularity)),
            max: Math.max(...nodes.map(n => n.popularity)),
            avg: nodes.reduce((sum, n) => sum + n.popularity, 0) / nodes.length
        };

        const yearStats = {
            min: Math.min(...nodes.map(n => n.releaseYear)),
            max: Math.max(...nodes.map(n => n.releaseYear)),
            avg: nodes.reduce((sum, n) => sum + n.releaseYear, 0) / nodes.length
        };

        const weightStats = {
            min: Math.min(...edges.map(e => e.weight)),
            max: Math.max(...edges.map(e => e.weight)),
            avg: edges.reduce((sum, e) => sum + e.weight, 0) / edges.length
        };

        return {
            nodes: nodes.length,
            edges: edges.length,
            popularity: popularityStats,
            releaseYears: yearStats,
            edgeWeights: weightStats
        };
    }

    /**
     * Export graph data to JSON file
     * @param {string} filename - Output filename
     */
    exportToJSON(filename = 'music-graph.json') {
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
    module.exports = MusicGraphConstructor;
}

// Export for browser
if (typeof window !== 'undefined') {
    window.MusicGraphConstructor = MusicGraphConstructor;
} 