"""
Vector Database Integration für semantische Video-Suche
Unterstützt ChromaDB, Pinecone und Weaviate
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import boto3
from datetime import datetime

logger = logging.getLogger(__name__)

class VideoVectorDB:
    """
    Vector Database für Video-Metadaten und semantische Suche
    """
    
    def __init__(self, db_type: str = "chromadb"):
        self.db_type = db_type.lower()
        self.model = SentenceTransformer('all-MiniLM-L6-v2')  # Lightweight embedding model
        self.client = None
        self.collection = None
        self._init_database()
    
    def _init_database(self):
        """Initialize the vector database based on type"""
        if self.db_type == "chromadb":
            self._init_chromadb()
        elif self.db_type == "pinecone":
            self._init_pinecone()
        elif self.db_type == "weaviate":
            self._init_weaviate()
        else:
            raise ValueError(f"Unsupported database type: {self.db_type}")
    
    def _init_chromadb(self):
        """Initialize ChromaDB (local/persistent)"""
        try:
            import chromadb
            from chromadb.config import Settings
            
            # Use persistent storage in backend directory
            persist_dir = os.path.join(os.path.dirname(__file__), "chromadb_data")
            os.makedirs(persist_dir, exist_ok=True)
            
            self.client = chromadb.PersistentClient(
                path=persist_dir,
                settings=Settings(anonymized_telemetry=False)
            )
            
            # Get or create collection for video metadata
            self.collection = self.client.get_or_create_collection(
                name="video_metadata",
                metadata={"description": "Video analysis results and metadata"}
            )
            
            logger.info(f"ChromaDB initialized with {self.collection.count()} existing documents")
            
        except ImportError:
            logger.error("ChromaDB not installed. Run: pip install chromadb")
            raise
    
    def _init_pinecone(self):
        """Initialize Pinecone (cloud-based)"""
        try:
            import pinecone
            
            api_key = os.environ.get("PINECONE_API_KEY")
            environment = os.environ.get("PINECONE_ENVIRONMENT", "us-west1-gcp-free")
            
            if not api_key:
                raise ValueError("PINECONE_API_KEY environment variable required")
            
            pinecone.init(api_key=api_key, environment=environment)
            
            index_name = "proovid-videos"
            
            # Create index if it doesn't exist
            if index_name not in pinecone.list_indexes():
                pinecone.create_index(
                    name=index_name,
                    dimension=384,  # Dimension for all-MiniLM-L6-v2
                    metric="cosine"
                )
            
            self.client = pinecone.Index(index_name)
            logger.info("Pinecone initialized successfully")
            
        except ImportError:
            logger.error("Pinecone not installed. Run: pip install pinecone-client")
            raise
    
    def _init_weaviate(self):
        """Initialize Weaviate (local/cloud)"""
        try:
            import weaviate
            
            weaviate_url = os.environ.get("WEAVIATE_URL", "http://localhost:8080")
            
            self.client = weaviate.Client(url=weaviate_url)
            
            # Create schema for video metadata
            schema = {
                "class": "VideoMetadata",
                "description": "Video analysis results and metadata",
                "properties": [
                    {
                        "name": "video_key",
                        "dataType": ["string"],
                        "description": "S3 key of the video"
                    },
                    {
                        "name": "semantic_tags",
                        "dataType": ["string[]"],
                        "description": "Semantic tags from video analysis"
                    },
                    {
                        "name": "analysis_results",
                        "dataType": ["text"],
                        "description": "Full analysis results as JSON"
                    }
                ]
            }
            
            # Create class if it doesn't exist
            if not self.client.schema.contains(schema):
                self.client.schema.create_class(schema)
            
            logger.info("Weaviate initialized successfully")
            
        except ImportError:
            logger.error("Weaviate not installed. Run: pip install weaviate-client")
            raise
    
    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """Create embeddings for text data"""
        return self.model.encode(texts)
    
    def store_video_analysis(self, job_id: str, video_metadata: Dict[str, Any], analysis_results: Dict[str, Any]):
        """
        Store video analysis results in vector database
        """
        try:
            # Extract semantic information for embedding
            semantic_content = []
            
            # Add basic video information
            video_key = video_metadata.get("key", "")
            bucket = video_metadata.get("bucket", "")
            semantic_content.append(f"Video: {video_key}")
            
            # Add labels/tags from analysis
            if "label_detection" in analysis_results:
                labels = analysis_results["label_detection"].get("semantic_tags", [])
                semantic_content.extend(labels)
                semantic_content.append(f"Contains: {', '.join(labels[:10])}")  # Top 10 labels
            
            # Add text content
            if "text_detection" in analysis_results:
                texts = analysis_results["text_detection"].get("text_detections", [])
                text_content = [t.get("text", "") for t in texts[:5]]  # Top 5 text detections
                semantic_content.extend(text_content)
            
            # Create searchable text
            searchable_text = " ".join(semantic_content)
            
            # Store based on database type
            if self.db_type == "chromadb":
                self._store_chromadb(job_id, video_metadata, analysis_results, searchable_text)
            elif self.db_type == "pinecone":
                self._store_pinecone(job_id, video_metadata, analysis_results, searchable_text)
            elif self.db_type == "weaviate":
                self._store_weaviate(job_id, video_metadata, analysis_results, searchable_text)
            
            logger.info(f"Stored video analysis for job {job_id} in vector database")
            
        except Exception as e:
            logger.error(f"Failed to store video analysis in vector DB: {e}")
            raise
    
    def _store_chromadb(self, job_id: str, video_metadata: Dict, analysis_results: Dict, searchable_text: str):
        """Store in ChromaDB"""
        # Create embedding
        embedding = self.model.encode([searchable_text])[0]
        
        # Prepare metadata
        metadata = {
            "job_id": job_id,
            "video_key": video_metadata.get("key", ""),
            "bucket": video_metadata.get("bucket", ""),
            "analysis_type": analysis_results.get("analysis_type", "unknown"),
            "timestamp": datetime.now().isoformat(),
            "has_labels": "label_detection" in analysis_results,
            "has_text": "text_detection" in analysis_results,
            "has_blackframes": "blackframes" in analysis_results
        }
        
        # Add semantic tags to metadata
        if "label_detection" in analysis_results:
            tags = analysis_results["label_detection"].get("semantic_tags", [])
            metadata["semantic_tags"] = json.dumps(tags[:20])  # Limit to 20 tags
        
        # Store in ChromaDB
        self.collection.upsert(
            ids=[job_id],
            embeddings=[embedding.tolist()],
            metadatas=[metadata],
            documents=[searchable_text]
        )
    
    def _store_pinecone(self, job_id: str, video_metadata: Dict, analysis_results: Dict, searchable_text: str):
        """Store in Pinecone"""
        # Create embedding
        embedding = self.model.encode([searchable_text])[0]
        
        # Prepare metadata (Pinecone has metadata size limits)
        metadata = {
            "job_id": job_id,
            "video_key": video_metadata.get("key", "")[:100],  # Limit string length
            "bucket": video_metadata.get("bucket", ""),
            "analysis_type": analysis_results.get("analysis_type", "unknown"),
            "timestamp": datetime.now().isoformat()
        }
        
        # Upsert to Pinecone
        self.client.upsert([(job_id, embedding.tolist(), metadata)])
    
    def _store_weaviate(self, job_id: str, video_metadata: Dict, analysis_results: Dict, searchable_text: str):
        """Store in Weaviate"""
        # Prepare data object
        data_object = {
            "video_key": video_metadata.get("key", ""),
            "semantic_tags": analysis_results.get("label_detection", {}).get("semantic_tags", [])[:50],
            "analysis_results": json.dumps(analysis_results)
        }
        
        # Store with vector
        self.client.data_object.create(
            data_object=data_object,
            class_name="VideoMetadata",
            uuid=job_id,
            vector=self.model.encode([searchable_text])[0].tolist()
        )
    
    def semantic_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Perform semantic search across video metadata
        """
        try:
            # Create query embedding
            query_embedding = self.model.encode([query])[0]
            
            if self.db_type == "chromadb":
                return self._search_chromadb(query_embedding, limit)
            elif self.db_type == "pinecone":
                return self._search_pinecone(query_embedding, limit)
            elif self.db_type == "weaviate":
                return self._search_weaviate(query, limit)
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    def _search_chromadb(self, query_embedding: np.ndarray, limit: int) -> List[Dict[str, Any]]:
        """Search ChromaDB"""
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=limit,
            include=["documents", "metadatas", "distances"]
        )
        
        search_results = []
        for i, doc_id in enumerate(results["ids"][0]):
            search_results.append({
                "job_id": doc_id,
                "score": 1 - results["distances"][0][i],  # Convert distance to similarity
                "metadata": results["metadatas"][0][i],
                "document": results["documents"][0][i]
            })
        
        return search_results
    
    def _search_pinecone(self, query_embedding: np.ndarray, limit: int) -> List[Dict[str, Any]]:
        """Search Pinecone"""
        results = self.client.query(
            vector=query_embedding.tolist(),
            top_k=limit,
            include_metadata=True
        )
        
        search_results = []
        for match in results["matches"]:
            search_results.append({
                "job_id": match["id"],
                "score": match["score"],
                "metadata": match["metadata"]
            })
        
        return search_results
    
    def _search_weaviate(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Search Weaviate"""
        result = self.client.query.get("VideoMetadata", ["video_key", "semantic_tags", "analysis_results"]) \
            .with_near_text({"concepts": [query]}) \
            .with_limit(limit) \
            .with_additional(["certainty"]) \
            .do()
        
        search_results = []
        for item in result["data"]["Get"]["VideoMetadata"]:
            search_results.append({
                "job_id": item.get("_additional", {}).get("id", ""),
                "score": item.get("_additional", {}).get("certainty", 0),
                "metadata": {
                    "video_key": item["video_key"],
                    "semantic_tags": item["semantic_tags"]
                },
                "analysis_results": json.loads(item["analysis_results"]) if item["analysis_results"] else {}
            })
        
        return search_results
    
    def get_video_count(self) -> int:
        """Get total number of videos in database"""
        if self.db_type == "chromadb":
            return self.collection.count()
        elif self.db_type == "pinecone":
            stats = self.client.describe_index_stats()
            return stats.get("total_vector_count", 0)
        elif self.db_type == "weaviate":
            result = self.client.query.aggregate("VideoMetadata").with_meta_count().do()
            return result["data"]["Aggregate"]["VideoMetadata"][0]["meta"]["count"]
        
        return 0
    
    def delete_video(self, job_id: str):
        """Delete video from vector database"""
        try:
            if self.db_type == "chromadb":
                self.collection.delete(ids=[job_id])
            elif self.db_type == "pinecone":
                self.client.delete(ids=[job_id])
            elif self.db_type == "weaviate":
                self.client.data_object.delete(uuid=job_id)
            
            logger.info(f"Deleted video {job_id} from vector database")
            
        except Exception as e:
            logger.error(f"Failed to delete video from vector DB: {e}")


# Helper function to get configured vector DB instance
_vector_db_instance = None

def get_vector_db() -> VideoVectorDB:
    """Get singleton vector database instance"""
    global _vector_db_instance
    
    if _vector_db_instance is None:
        db_type = os.environ.get("VECTOR_DB_TYPE", "chromadb")
        _vector_db_instance = VideoVectorDB(db_type=db_type)
    
    return _vector_db_instance