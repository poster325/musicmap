// Artist Map Generator
// Pre-generates the artist ecosystem map and saves it as static JSON
// Run this script periodically (weekly/monthly) to update the map

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Spotify configuration
const SPOTIFY_CLIENT_ID = '1b0ff5378cca441899cca8bebaf71d1a';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Import the artist graph constructor
const { ArtistGraphConstructor } = require('./artist-graph-constructor.js');

class ArtistMapGenerator {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = 0;
    }

    // Get access token using client credentials flow
    async getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
            return this.accessToken;
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

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            console.log('✅ Spotify access token refreshed');
            return this.accessToken;
        } catch (error) {
            console.error('❌ Failed to get access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Spotify');
        }
    }

    // Fetch comprehensive music ecosystem data
    async fetchEcosystemData() {
        const token = await this.getAccessToken();
        console.log('🔄 Fetching comprehensive music ecosystem data...');

        // Get featured playlists
        const featuredResponse = await axios.get('https://api.spotify.com/v1/browse/featured-playlists?limit=50', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Get new releases
        const newReleasesResponse = await axios.get('https://api.spotify.com/v1/browse/new-releases?limit=50', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Get top categories
        const categoriesResponse = await axios.get('https://api.spotify.com/v1/browse/categories?limit=20', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Get playlists for top categories
        const categoryPlaylists = [];
        const topCategories = categoriesResponse.data.categories.items.slice(0, 10);
        
        for (const category of topCategories) {
            try {
                console.log(`📂 Fetching playlists for category: ${category.name}`);
                const categoryPlaylistsResponse = await axios.get(`https://api.spotify.com/v1/browse/categories/${category.id}/playlists?limit=10`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                categoryPlaylists.push(...categoryPlaylistsResponse.data.playlists.items.map(playlist => ({
                    ...playlist,
                    category: category.name
                })));
                
                // Rate limiting - wait a bit between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`⚠️ Failed to fetch playlists for category ${category.name}:`, error.message);
            }
        }

        // Get trending playlists (global charts)
        const trendingResponse = await axios.get('https://api.spotify.com/v1/browse/featured-playlists?limit=20&country=US', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return {
            featuredPlaylists: featuredResponse.data.playlists.items,
            newReleases: newReleasesResponse.data.albums.items,
            categoryPlaylists: categoryPlaylists,
            trendingPlaylists: trendingResponse.data.playlists.items,
            categories: categoriesResponse.data.categories.items,
            totalPlaylists: featuredResponse.data.playlists.items.length + categoryPlaylists.length + trendingResponse.data.playlists.items.length,
            totalAlbums: newReleasesResponse.data.albums.items.length
        };
    }

    // Get detailed track data for playlists
    async getPlaylistTracks(playlist, token) {
        try {
            const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            playlist.tracks = response.data;
            return playlist;
        } catch (error) {
            console.warn(`⚠️ Failed to fetch tracks for playlist ${playlist.name}:`, error.message);
            return null;
        }
    }

    // Build the artist graph from ecosystem data
    async buildArtistGraph(ecosystemData) {
        console.log('🎵 Building artist graph from ecosystem data...');
        
        const token = await this.getAccessToken();
        const allPlaylists = [
            ...ecosystemData.featuredPlaylists,
            ...ecosystemData.categoryPlaylists,
            ...ecosystemData.trendingPlaylists
        ];

        console.log(`📊 Processing ${allPlaylists.length} playlists for artist analysis...`);

        // Get track data for each playlist (limit to prevent API rate limits)
        const playlistsWithTracks = [];
        const processedPlaylists = allPlaylists.slice(0, 200); // Can handle more with artist analysis
        
        for (let i = 0; i < processedPlaylists.length; i++) {
            const playlist = processedPlaylists[i];
            console.log(`📂 Processing playlist ${i + 1}/${processedPlaylists.length}: ${playlist.name}`);
            
            const playlistWithTracks = await this.getPlaylistTracks(playlist, token);
            if (playlistWithTracks && playlistWithTracks.tracks && playlistWithTracks.tracks.items.length > 0) {
                playlistsWithTracks.push(playlistWithTracks);
            }
            
            // Rate limiting
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`✅ Successfully processed ${playlistsWithTracks.length} playlists with tracks`);

        // Build artist graph
        const graphConstructor = new ArtistGraphConstructor();
        graphConstructor.minEdgeWeight = 3; // Adjust sensitivity
        
        const graphData = graphConstructor.buildGraphFromPlaylists(playlistsWithTracks);
        const stats = graphConstructor.getGraphStats();

        return {
            graph: graphData,
            stats: stats,
            metadata: {
                generatedAt: new Date().toISOString(),
                playlistsAnalyzed: playlistsWithTracks.length,
                totalPlaylists: allPlaylists.length,
                ecosystemData: {
                    featuredPlaylists: ecosystemData.featuredPlaylists.length,
                    categoryPlaylists: ecosystemData.categoryPlaylists.length,
                    trendingPlaylists: ecosystemData.trendingPlaylists.length,
                    newReleases: ecosystemData.newReleases.length
                }
            }
        };
    }

    // Save the generated map to file
    async saveMapToFile(mapData, filename = 'artist-ecosystem-map.json') {
        try {
            const filePath = path.join(__dirname, 'public', filename);
            
            // Ensure public directory exists
            try {
                await fs.mkdir(path.join(__dirname, 'public'), { recursive: true });
            } catch (error) {
                // Directory might already exist
            }
            
            await fs.writeFile(filePath, JSON.stringify(mapData, null, 2));
            console.log(`💾 Artist map saved to: ${filePath}`);
            
            // Also save a timestamp file
            const timestampData = {
                lastUpdated: new Date().toISOString(),
                mapFile: filename,
                stats: mapData.stats
            };
            
            await fs.writeFile(path.join(__dirname, 'public', 'map-timestamp.json'), JSON.stringify(timestampData, null, 2));
            console.log('📅 Timestamp file updated');
            
            return filePath;
        } catch (error) {
            console.error('❌ Failed to save map file:', error);
            throw error;
        }
    }

    // Generate and save the complete artist map
    async generateArtistMap() {
        try {
            console.log('🚀 Starting artist map generation...');
            console.log('⏰ Started at:', new Date().toISOString());
            
            // Step 1: Fetch ecosystem data
            const ecosystemData = await this.fetchEcosystemData();
            console.log(`✅ Fetched ecosystem data: ${ecosystemData.totalPlaylists} playlists, ${ecosystemData.totalAlbums} albums`);
            
            // Step 2: Build artist graph
            const mapData = await this.buildArtistGraph(ecosystemData);
            console.log(`✅ Built artist graph: ${mapData.stats.artists} artists, ${mapData.stats.connections} connections`);
            
            // Step 3: Save to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `artist-ecosystem-map-${timestamp}.json`;
            await this.saveMapToFile(mapData, filename);
            
            console.log('🎉 Artist map generation completed successfully!');
            console.log('⏰ Completed at:', new Date().toISOString());
            
            // Print summary
            console.log('\n📊 Map Summary:');
            console.log(`   🎤 Artists: ${mapData.stats.artists}`);
            console.log(`   🔗 Connections: ${mapData.stats.connections}`);
            console.log(`   📈 Avg Popularity: ${Math.round(mapData.stats.popularity.avg)}`);
            console.log(`   📅 Avg Release Year: ${Math.round(mapData.stats.releaseYears.avg)}`);
            console.log(`   ⚡ Avg Connection Weight: ${Math.round(mapData.stats.connectionWeights.avg)}`);
            
            return mapData;
        } catch (error) {
            console.error('❌ Artist map generation failed:', error);
            throw error;
        }
    }
}

// Main execution
async function main() {
    if (!SPOTIFY_CLIENT_SECRET) {
        console.error('❌ SPOTIFY_CLIENT_SECRET environment variable is required');
        console.log('💡 Set it with: $env:SPOTIFY_CLIENT_SECRET="your_secret_here"');
        process.exit(1);
    }

    const generator = new ArtistMapGenerator();
    
    try {
        await generator.generateArtistMap();
        console.log('\n✅ Artist map generation completed!');
        console.log('🌐 You can now serve the map from the public/ directory');
    } catch (error) {
        console.error('❌ Generation failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { ArtistMapGenerator }; 