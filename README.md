# 🎵 Music Map

An interactive music discovery application with Spotify integration, featuring a comprehensive graph-based visualization of music relationships based on playlist co-occurrences.

## 🎯 Overview

This project implements a complete interactive music mapping system that:

1. **Extracts music data** from Spotify playlists (similar to #nowplaying dataset)
2. **Builds a co-occurrence graph** where tracks are connected if they appear together in playlists
3. **Visualizes the music map** with interactive features using Cytoscape.js
4. **Provides filtering and exploration** tools for music discovery

## 🚀 Features

- 🔐 Secure Spotify OAuth authentication
- 🔄 Automatic token refresh
- 🎵 Spotify API integration
- 📊 Comprehensive data extraction (users, playlists, tracks)
- 🎼 Genre analysis and recommendations
- 🗺️ Interactive graph visualization
- 🔍 Advanced filtering and search
- 📈 Graph layout optimization for large datasets
- 🚀 Ready for Vercel deployment

## 🏗️ Architecture

### Data Collection & Graph Construction

- **Source**: Spotify API + playlist co-occurrence analysis
- **Unit**: Playlist = cognitively linked track groups
- **Graph Structure**:
  - Nodes = Tracks
  - Edges = Co-occurrence in playlists
  - Edge weight = Number of shared playlists

### Visualization Options

- **Option A**: Precomputed layouts (Python + networkx + fa2) - Recommended for large graphs
- **Option B**: Real-time layouts (Cytoscape.js) - For smaller datasets

### Visual Mapping

- **Node Size**: Track popularity (0-100)
- **Node Color**: Release year (gradient from dark → light)
- **Edge Thickness**: Co-occurrence strength
- **Node Labels**: Track name/artist on hover

## 📁 Project Structure

```
musicmap/
├── index.html                 # Main application interface
├── music-map-visualization.html  # Interactive graph visualization
├── server.js                  # Express.js backend with Spotify API
├── graph-constructor.js       # Graph building and co-occurrence analysis
├── layout-generator.py        # Python layout computation (Option A)
├── test-data-extraction.js    # Data extraction testing
├── package.json              # Node.js dependencies
├── requirements.txt          # Python dependencies
├── env.example              # Environment variables template
└── README.md                # This file
```

## 🛠️ Setup Instructions

### 1. Spotify App Configuration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app or use an existing one
3. Note your **Client ID** (already configured: `1b0ff5378cca441899cca8bebaf71d1a`)
4. Get your **Client Secret** from the app settings
5. Add redirect URIs:
   - For local development: `http://localhost:3000/callback`
   - For production: `https://your-app-name.vercel.app/callback`

### 2. Environment Variables

1. Copy `env.example` to `.env`
2. Add your Spotify Client Secret:
   ```
   SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
   REDIRECT_URI=http://localhost:3000/callback
   ```

### 3. Node.js Setup (Backend + Frontend)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

### 4. Python Setup (Layout Generation - Optional)

For large graph layouts, install Python dependencies:

```bash
pip install -r requirements.txt
```

### 5. Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `SPOTIFY_CLIENT_SECRET`: Your Spotify client secret
   - `REDIRECT_URI`: Your Vercel app URL + `/callback`
4. Deploy!

## 🎮 Usage

### Web Interface

1. **Login**: Click "Login with Spotify" to authenticate
2. **Refresh Token**: Click "Refresh Token" to get a new access token
3. **Test API**: Click "Test Spotify API" to verify the connection
4. **Extract Data**: Use the various data extraction buttons:
   - 📋 My Playlists: Get all your playlists
   - 🏆 Top Tracks: Get your most listened tracks
   - 🎼 Genres: Get available genre seeds
   - 📝 Playlist Details: Get detailed info about a specific playlist
5. **🗺️ Music Map**: Open the interactive graph visualization

### Interactive Music Map

1. **Build Graph**: Click "Build Graph" to create the music map from your playlists
2. **Explore**: Zoom, pan, and click on nodes to explore
3. **Filter**: Use year and popularity filters to focus on specific tracks
4. **Interact**: Hover for info, click to play previews or open in Spotify
5. **Export**: Download the graph data for further analysis

### Layout Generation (Python)

For large datasets, precompute layouts:

```bash
# Generate layout from exported graph
python layout-generator.py music-map-graph.json --algorithm force_atlas2 --iterations 2000

# With statistics
python layout-generator.py music-map-graph.json --stats --output my-layout.json
```

## 🔧 API Endpoints

### Authentication

- `GET /` - Main application page
- `GET /visualization` - Interactive music map
- `GET /auth/spotify` - Initiate Spotify OAuth
- `GET /callback` - OAuth callback handler
- `POST /refresh-token` - Refresh access token
- `GET /access-token` - Get current access token
- `GET /test-spotify` - Test Spotify API connection

### Data Extraction

- `GET /user-playlists` - Get user's playlists
- `GET /playlist/:playlistId` - Get playlist details
- `GET /playlist/:playlistId/tracks` - Get playlist tracks
- `GET /user-top-tracks` - Get user's top tracks
- `GET /genres` - Get available genres
- `GET /track/:trackId/features` - Get track audio features

## 📊 Data Structure

The extracted data follows this structure, similar to the #nowplaying dataset:

```javascript
{
  users: [
    {
      id: "spotify_user_id",
      display_name: "User Name",
      playlists_count: 15
    }
  ],
  playlists: [
    {
      id: "playlist_id",
      name: "Playlist Name",
      description: "Description",
      owner_id: "user_id",
      tracks_count: 50,
      public: true,
      collaborative: false
    }
  ],
  tracks: [
    {
      id: "track_id",
      name: "Track Name",
      artists: [
        { id: "artist_id", name: "Artist Name" }
      ],
      album: { id: "album_id", name: "Album Name" },
      duration_ms: 180000,
      popularity: 85,
      added_at: "2024-01-01T00:00:00Z",
      added_by: "user_id"
    }
  ]
}
```

## 🎨 Graph Visualization Features

### Interactive Elements

- **Zoom & Pan**: Navigate the music map
- **Hover Effects**: Show track information
- **Click Actions**: Play previews or open Spotify URLs
- **Selection**: Highlight and analyze specific tracks
- **Filtering**: By year, artist, or popularity

### Visual Mapping

- **Node Size**: Proportional to track popularity
- **Node Color**: Gradient based on release year
- **Edge Thickness**: Proportional to co-occurrence strength
- **Node Labels**: Track names with artist information

### Layout Algorithms

- **ForceAtlas2**: Optimal for large graphs (Python)
- **Spring Layout**: Real-time computation (JavaScript)
- **Kamada-Kawai**: Aesthetic layouts
- **Fruchterman-Reingold**: Force-directed layouts

## 🔍 Testing

### Data Extraction Test

```bash
node test-data-extraction.js
```

### Layout Generation Test

```bash
# First export a graph from the web interface
# Then generate layout
python layout-generator.py music-map-graph.json --stats
```

## 🔒 Security Notes

- Client secret is stored securely in environment variables
- Tokens are stored server-side (in production, use a database)
- OAuth flow follows Spotify's security best practices
- All API calls use proper authorization headers

## 🚀 Next Steps

- Add database for persistent data storage
- Implement collaborative filtering for recommendations
- Add user preference analysis and learning
- Create music genre clustering and analysis
- Build social features and playlist sharing
- Add real-time music recommendations
- Implement advanced graph algorithms for music discovery

## 🛠️ Technologies Used

### Frontend

- HTML/CSS/JavaScript
- Cytoscape.js (graph visualization)
- Spotify Web API

### Backend

- Node.js + Express
- Spotify Web API integration
- OAuth 2.0 authentication

### Data Processing

- Python + networkx (graph analysis)
- ForceAtlas2 (layout algorithms)
- NumPy (numerical computing)

### Deployment

- Vercel (hosting and deployment)

## 📚 API Documentation References

- [Spotify Web API Overview](https://developer.spotify.com/documentation/web-api)
- [Get Playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist)
- [Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks)
- [Get Available Genre Seeds](https://developer.spotify.com/documentation/web-api/reference/get-recommendation-genres)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
