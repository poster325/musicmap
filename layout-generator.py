#!/usr/bin/env python3
"""
Music Map Layout Generator
Precomputes graph layouts for large music graphs using networkx and force-directed algorithms.
This implements Option A from the plan for handling large datasets efficiently.
"""

import json
import networkx as nx
import numpy as np
from datetime import datetime
import argparse
import os

try:
    from fa2 import ForceAtlas2
    FA2_AVAILABLE = True
except ImportError:
    FA2_AVAILABLE = False
    print("Warning: fa2 not available. Using networkx spring layout instead.")

class MusicMapLayoutGenerator:
    def __init__(self, layout_algorithm='force_atlas2'):
        """
        Initialize the layout generator
        
        Args:
            layout_algorithm (str): 'force_atlas2', 'spring', 'kamada_kawai', or 'fruchterman_reingold'
        """
        self.layout_algorithm = layout_algorithm
        self.G = nx.Graph()
        
    def load_graph_from_json(self, json_file):
        """
        Load graph data from JSON file (output from graph-constructor.js)
        
        Args:
            json_file (str): Path to JSON file
        """
        print(f"📁 Loading graph from {json_file}...")
        
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        # Extract graph data
        graph_data = data.get('graph', {})
        nodes = graph_data.get('nodes', [])
        edges = graph_data.get('edges', [])
        
        # Add nodes to networkx graph
        for node in nodes:
            node_data = node.get('data', {})
            self.G.add_node(
                node_data['id'],
                name=node_data.get('name', ''),
                artist=node_data.get('artist', ''),
                album=node_data.get('album', ''),
                popularity=node_data.get('popularity', 0),
                releaseYear=node_data.get('releaseYear', 2000),
                size=node_data.get('size', 20),
                color=node_data.get('color', '#1DB954')
            )
        
        # Add edges to networkx graph
        for edge in edges:
            edge_data = edge.get('data', {})
            self.G.add_edge(
                edge_data['source'],
                edge_data['target'],
                weight=edge_data.get('weight', 1),
                thickness=edge_data.get('thickness', 1)
            )
        
        print(f"✅ Loaded graph: {self.G.number_of_nodes()} nodes, {self.G.number_of_edges()} edges")
        
    def compute_layout(self, **kwargs):
        """
        Compute node positions using the specified layout algorithm
        
        Args:
            **kwargs: Additional parameters for the layout algorithm
        """
        print(f"🔄 Computing layout using {self.layout_algorithm}...")
        
        if self.layout_algorithm == 'force_atlas2' and FA2_AVAILABLE:
            positions = self._compute_force_atlas2_layout(**kwargs)
        elif self.layout_algorithm == 'spring':
            positions = self._compute_spring_layout(**kwargs)
        elif self.layout_algorithm == 'kamada_kawai':
            positions = self._compute_kamada_kawai_layout(**kwargs)
        elif self.layout_algorithm == 'fruchterman_reingold':
            positions = self._compute_fruchterman_reingold_layout(**kwargs)
        else:
            print("⚠️  ForceAtlas2 not available, using spring layout")
            positions = self._compute_spring_layout(**kwargs)
        
        # Store positions in graph
        nx.set_node_attributes(self.G, positions, 'pos')
        
        print("✅ Layout computation completed")
        return positions
    
    def _compute_force_atlas2_layout(self, **kwargs):
        """Compute layout using ForceAtlas2 algorithm"""
        # Convert graph to adjacency matrix
        adjacency_matrix = nx.to_numpy_array(self.G)
        
        # Initialize ForceAtlas2
        forceatlas2 = ForceAtlas2(
            # Behavior alternatives
            outboundAttractionDistribution=True,  # Dissuade hubs
            linLogMode=False,  # NOT using logarithmic attraction
            adjustSizes=False,  # Don't adjust node sizes
            edgeWeightInfluence=1.0,
            
            # Performance
            jitterTolerance=1.0,  # Tolerance
            barnesHutOptimize=True,
            barnesHutTheta=1.2,
            multiThreaded=False,  # NOT using multithreading
            
            # Tuning
            scalingRatio=2.0,
            strongGravityMode=False,
            gravity=1.0,
            
            # Speed
            slowDown=1,
            verbose=True
        )
        
        # Compute positions
        positions = forceatlas2.forceatlas2(adjacency_matrix, pos=None, iterations=2000)
        
        # Convert to dictionary format
        node_ids = list(self.G.nodes())
        return {node_ids[i]: {'x': float(positions[i][0]), 'y': float(positions[i][1])} 
                for i in range(len(node_ids))}
    
    def _compute_spring_layout(self, **kwargs):
        """Compute layout using spring layout algorithm"""
        positions = nx.spring_layout(
            self.G,
            k=kwargs.get('k', 1),  # Optimal distance between nodes
            iterations=kwargs.get('iterations', 50),
            scale=kwargs.get('scale', 1.0),
            center=kwargs.get('center', (0, 0))
        )
        
        # Convert to our format
        return {node: {'x': float(pos[0]), 'y': float(pos[1])} 
                for node, pos in positions.items()}
    
    def _compute_kamada_kawai_layout(self, **kwargs):
        """Compute layout using Kamada-Kawai algorithm"""
        positions = nx.kamada_kawai_layout(
            self.G,
            scale=kwargs.get('scale', 1.0),
            center=kwargs.get('center', (0, 0))
        )
        
        return {node: {'x': float(pos[0]), 'y': float(pos[1])} 
                for node, pos in positions.items()}
    
    def _compute_fruchterman_reingold_layout(self, **kwargs):
        """Compute layout using Fruchterman-Reingold algorithm"""
        positions = nx.fruchterman_reingold_layout(
            self.G,
            k=kwargs.get('k', 1),
            iterations=kwargs.get('iterations', 50),
            scale=kwargs.get('scale', 1.0),
            center=kwargs.get('center', (0, 0))
        )
        
        return {node: {'x': float(pos[0]), 'y': float(pos[1])} 
                for node, pos in positions.items()}
    
    def export_layout(self, output_file=None):
        """
        Export the computed layout to JSON file
        
        Args:
            output_file (str): Output file path
        """
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"music-map-layout_{timestamp}.json"
        
        # Prepare layout data
        layout_data = {
            'metadata': {
                'generatedAt': datetime.now().isoformat(),
                'algorithm': self.layout_algorithm,
                'nodes': self.G.number_of_nodes(),
                'edges': self.G.number_of_edges(),
                'fa2_available': FA2_AVAILABLE
            },
            'layout': {}
        }
        
        # Add node positions
        for node_id in self.G.nodes():
            node_data = self.G.nodes[node_id]
            pos = node_data.get('pos', {'x': 0, 'y': 0})
            
            layout_data['layout'][node_id] = {
                'x': pos['x'],
                'y': pos['y'],
                'name': node_data.get('name', ''),
                'artist': node_data.get('artist', ''),
                'album': node_data.get('album', ''),
                'popularity': node_data.get('popularity', 0),
                'releaseYear': node_data.get('releaseYear', 2000),
                'size': node_data.get('size', 20),
                'color': node_data.get('color', '#1DB954')
            }
        
        # Save to file
        with open(output_file, 'w') as f:
            json.dump(layout_data, f, indent=2)
        
        print(f"💾 Layout exported to {output_file}")
        return output_file
    
    def get_graph_statistics(self):
        """Get statistics about the graph"""
        stats = {
            'nodes': self.G.number_of_nodes(),
            'edges': self.G.number_of_edges(),
            'density': nx.density(self.G),
            'average_clustering': nx.average_clustering(self.G),
            'connected_components': nx.number_connected_components(self.G),
            'largest_component_size': len(max(nx.connected_components(self.G), key=len)),
            'average_degree': sum(dict(self.G.degree()).values()) / self.G.number_of_nodes()
        }
        
        # Node attribute statistics
        popularities = [self.G.nodes[node].get('popularity', 0) for node in self.G.nodes()]
        years = [self.G.nodes[node].get('releaseYear', 2000) for node in self.G.nodes()]
        
        stats['popularity'] = {
            'min': min(popularities),
            'max': max(popularities),
            'avg': sum(popularities) / len(popularities)
        }
        
        stats['releaseYears'] = {
            'min': min(years),
            'max': max(years),
            'avg': sum(years) / len(years)
        }
        
        return stats

def main():
    parser = argparse.ArgumentParser(description='Generate layout for Music Map graph')
    parser.add_argument('input_file', help='Input JSON file from graph-constructor.js')
    parser.add_argument('--algorithm', '-a', default='force_atlas2',
                       choices=['force_atlas2', 'spring', 'kamada_kawai', 'fruchterman_reingold'],
                       help='Layout algorithm to use')
    parser.add_argument('--output', '-o', help='Output JSON file')
    parser.add_argument('--iterations', '-i', type=int, default=2000,
                       help='Number of iterations for layout computation')
    parser.add_argument('--stats', '-s', action='store_true',
                       help='Print graph statistics')
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input_file):
        print(f"❌ Error: Input file {args.input_file} not found")
        return
    
    # Initialize layout generator
    generator = MusicMapLayoutGenerator(layout_algorithm=args.algorithm)
    
    # Load graph
    generator.load_graph_from_json(args.input_file)
    
    # Print statistics if requested
    if args.stats:
        stats = generator.get_graph_statistics()
        print("\n📊 Graph Statistics:")
        for key, value in stats.items():
            if isinstance(value, dict):
                print(f"  {key}:")
                for subkey, subvalue in value.items():
                    print(f"    {subkey}: {subvalue}")
            else:
                print(f"  {key}: {value}")
        print()
    
    # Compute layout
    generator.compute_layout(iterations=args.iterations)
    
    # Export layout
    output_file = generator.export_layout(args.output)
    
    print(f"🎉 Layout generation completed! Output: {output_file}")

if __name__ == "__main__":
    main() 