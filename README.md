# 🎤 Artist Ecosystem Map

An interactive visualization tool that analyzes the relationships between artists in the global music ecosystem using Spotify's API. Instead of analyzing individual tracks, this tool focuses on **artist-level connections** based on co-occurrence in playlists, making it much more scalable and meaningful.

## 🌟 Key Features

- **Artist-Based Analysis**: Analyzes relationships between artists rather than individual tracks
- **Scalable Processing**: Can handle 1000s of playlists efficiently (vs 30+ for track analysis)
- **Co-occurrence Mapping**: Shows which artists frequently appear together in playlists
- **Interactive Visualization**: Built with Cytoscape.js for dynamic exploration
- **Real-time Data**: Fetches current trending and featured playlists from Spotify
- **Comprehensive Ecosystem**: Analyzes featured, trending, and category playlists

## 🎯 Why Artist-Based Analysis?

**Track-level analysis was too complex:**

- 100,000s of tracks vs 1000s of artists
- Too many edges to visualize meaningfully
- API rate limits with large datasets

**Artist-level analysis is much better:**

- Fewer, more meaningful nodes
- Clearer musical relationships and collaborations
- Can analyze 1000s of playlists efficiently
- Better scalability and performance

## 🚀 Quick Start

1. **Clone and Setup**

   ```bash
   git clone <your-repo>
   cd musicmap
   npm install
   ```

2. **Configure Spotify API**

   - Create a Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Copy your Client ID and Client Secret
   - Create `.env` file:

   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   ```

3. **Run the Application**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`

4. **Build Artist Graph**
   - Click "🔍 Build Artist Graph"
   - Adjust "Min Connection Weight" (default: 3)
   - Explore the artist relationships!

## 📊 How It Works

### 1. Data Collection

- Fetches **featured playlists** from Spotify's global charts
- Collects **trending playlists** across different regions
- Gathers **category playlists** (pop, rock, hip-hop, etc.)
- Processes **100+ playlists** for comprehensive analysis

### 2. Artist Relationship Analysis

- Extracts all artists from each playlist
- Creates **co-occurrence edges** between artists in the same playlist
- Calculates **connection weights** based on shared playlist count
- Filters connections below minimum weight threshold

### 3. Visualization

- **Node Size**: Based on track count and popularity
- **Node Color**: Based on average release year (newer = blue, older = red)
- **Edge Thickness**: Based on connection strength
- **Interactive**: Hover for details, click to explore

## 🎨 Visualization Features

### Artist Nodes

- **Size**: Larger = more tracks and higher popularity
- **Color**: Blue = newer artists, Red = older artists
- **Tooltip**: Shows track count, popularity, release year, connections

### Artist Connections

- **Thickness**: Thicker = stronger connection (more shared playlists)
- **Weight**: Number of playlists where both artists appear
- **Tooltip**: Shows co-occurrence details and shared playlist count

### Controls

- **Min Connection Weight**: Filter out weak connections
- **Year Filter**: Focus on specific time periods
- **Popularity Filter**: Show only popular artists

## 📈 Analysis Capabilities

### Scalability

- **100+ playlists** analyzed simultaneously
- **1000s of artists** processed efficiently
- **Real-time** ecosystem data collection

### Insights

- **Genre clusters**: Artists grouped by musical style
- **Collaboration networks**: Artists who frequently work together
- **Temporal patterns**: New vs established artist relationships
- **Popularity distribution**: Chart-topping vs niche artists

## 🔧 Technical Stack

- **Backend**: Node.js + Express.js
- **Frontend**: HTML5 + CSS3 + JavaScript
- **Visualization**: Cytoscape.js
- **API**: Spotify Web API
- **Data Processing**: Custom artist graph constructor

## 📁 Project Structure

```
musicmap/
├── server.js                 # Express server with Spotify OAuth
├── index.html               # Main application page
├── music-map-visualization.html  # Interactive artist graph
├── artist-graph-constructor.js   # Artist relationship analysis
├── ecosystem-data-collector.js   # Spotify data collection
├── package.json             # Dependencies
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🎵 Data Sources

The system analyzes multiple types of playlists:

1. **Featured Playlists**: Spotify's curated global charts
2. **Trending Playlists**: Currently popular playlists
3. **Category Playlists**: Genre-specific collections
4. **New Releases**: Latest music from various artists

This provides a comprehensive view of the current music ecosystem.

## 🔍 Advanced Usage

### Custom Analysis

```javascript
// Use the artist graph constructor directly
const constructor = new ArtistGraphConstructor();
constructor.minEdgeWeight = 5; // Adjust sensitivity
const graphData = constructor.buildGraphFromPlaylists(playlists);
```

### Export Data

- Click "💾 Export" to download graph data as JSON
- Includes metadata, statistics, and full graph structure
- Compatible with other graph analysis tools

### Filtering

- Adjust minimum connection weight for different detail levels
- Use year filters to focus on specific time periods
- Filter by popularity to see chart-topping artists

## 🚀 Deployment

### Vercel Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy automatically

### Local Development

```bash
npm run dev          # Development server
npm start           # Production server
```

## 📊 Performance

- **Processing**: 100+ playlists in ~30 seconds
- **Visualization**: Smooth interaction with 1000+ nodes
- **Memory**: Efficient artist-level data structures
- **API**: Optimized Spotify API usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🎯 Future Enhancements

- **Genre clustering**: Automatic artist grouping by style
- **Temporal analysis**: How relationships change over time
- **Collaboration detection**: Identify actual collaborations vs playlist co-occurrence
- **Regional analysis**: Compare artist relationships across countries
- **Machine learning**: Predict new artist connections

---

**Built with ❤️ for music discovery and analysis**
