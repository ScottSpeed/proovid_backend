"""
AWS-Native Vector Database Integration 
Nutzt AWS OpenSearch mit Vector Search für semantische Video-Suche
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional
import numpy as np
import boto3
from datetime import datetime
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

logger = logging.getLogger(__name__)

class AWSVectorDB:
    """
    AWS-Native Vector Database für Video-Metadaten
    Nutzt OpenSearch mit Vector Search (k-NN)
    """
    
    def __init__(self):
        self.region = os.environ.get('AWS_DEFAULT_REGION', 'eu-central-1')
        self.opensearch_endpoint = os.environ.get('OPENSEARCH_ENDPOINT')
        self.index_name = 'proovid-videos'
        self.client = None
        self.s3_client = boto3.client('s3', region_name=self.region)
        self.bedrock_client = boto3.client('bedrock-runtime', region_name=self.region)
        self._init_opensearch()
    
    def _init_opensearch(self):
        """Initialize OpenSearch client with AWS auth"""
        if not self.opensearch_endpoint:
            logger.error("OPENSEARCH_ENDPOINT environment variable required")
            raise ValueError("OpenSearch endpoint not configured")
        
        # Use IAM authentication
        credentials = boto3.Session().get_credentials()
        awsauth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            self.region,
            'es',
            session_token=credentials.token
        )
        
        self.client = OpenSearch(
            hosts=[{'host': self.opensearch_endpoint.replace('https://', ''), 'port': 443}],
            http_auth=awsauth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection
        )
        
        # Create index if it doesn't exist
        self._create_index_if_not_exists()
        logger.info(f"OpenSearch initialized: {self.opensearch_endpoint}")
    
    def _create_index_if_not_exists(self):
        """Create OpenSearch index with vector field mapping"""
        if self.client.indices.exists(index=self.index_name):
            return
        
        # Index mapping for vector search
        mapping = {
            "settings": {
                "index": {
                    "knn": True,
                    "knn.algo_param.ef_search": 512
                }
            },
            "mappings": {
                "properties": {
                    "job_id": {"type": "keyword"},
                    "video_key": {"type": "text"},
                    "bucket": {"type": "keyword"},
                    "semantic_content": {"type": "text"},
                    "semantic_tags": {"type": "keyword"},
                    "analysis_type": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "has_labels": {"type": "boolean"},
                    "has_text": {"type": "boolean"},
                    "has_blackframes": {"type": "boolean"},
                    "embedding_vector": {
                        "type": "knn_vector",
                        "dimension": 1536,  # Amazon Titan Embeddings dimension
                        "method": {
                            "name": "hnsw",
                            "space_type": "cosinesimil",
                            "engine": "nmslib"
                        }
                    }
                }
            }
        }
        
        self.client.indices.create(index=self.index_name, body=mapping)
        logger.info(f"Created OpenSearch index: {self.index_name}")
    
    def create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings using AWS Bedrock Titan"""
        embeddings = []
        
        for text in texts:
            try:
                # Use Amazon Titan Embeddings
                response = self.bedrock_client.invoke_model(
                    modelId='amazon.titan-embed-text-v1',
                    body=json.dumps({
                        "inputText": text[:8000]  # Limit text length
                    })
                )
                
                result = json.loads(response['body'].read())
                embedding = result['embedding']
                embeddings.append(embedding)
                
            except Exception as e:
                logger.error(f"Failed to create embedding: {e}")
                # Fallback: zero vector
                embeddings.append([0.0] * 1536)
        
        return embeddings
    
    def store_video_analysis(self, job_id: str, video_metadata: Dict[str, Any], analysis_results: Dict[str, Any]):
        """Store video analysis in OpenSearch"""
        try:
            # Extract semantic information
            semantic_content = []
            semantic_tags = []
            
            # Add video info
            video_key = video_metadata.get("key", "")
            bucket = video_metadata.get("bucket", "")
            semantic_content.append(f"Video: {video_key}")
            
            # Extract labels
            if "label_detection" in analysis_results:
                labels = analysis_results["label_detection"].get("semantic_tags", [])
                semantic_tags.extend(labels[:50])  # Limit to 50 tags
                semantic_content.extend(labels[:20])  # Top 20 for embedding
                semantic_content.append(f"Contains: {', '.join(labels[:10])}")
            
            # Extract text content
            if "text_detection" in analysis_results:
                texts = analysis_results["text_detection"].get("text_detections", [])
                text_content = [t.get("text", "") for t in texts[:5]]
                semantic_content.extend(text_content)
            
            # Create searchable text and embedding
            searchable_text = " ".join(semantic_content)
            embeddings = self.create_embeddings([searchable_text])
            
            # Prepare document
            doc = {
                "job_id": job_id,
                "video_key": video_key,
                "bucket": bucket,
                "semantic_content": searchable_text,
                "semantic_tags": semantic_tags,
                "analysis_type": analysis_results.get("analysis_type", "unknown"),
                "timestamp": datetime.now().isoformat(),
                "has_labels": "label_detection" in analysis_results,
                "has_text": "text_detection" in analysis_results,
                "has_blackframes": "blackframes" in analysis_results,
                "embedding_vector": embeddings[0]
            }
            
            # Store in OpenSearch
            response = self.client.index(
                index=self.index_name,
                id=job_id,
                body=doc,
                refresh=True
            )
            
            logger.info(f"Stored video analysis for job {job_id} in OpenSearch")
            return response
            
        except Exception as e:
            logger.error(f"Failed to store video analysis: {e}")
            raise
    
    def semantic_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Perform semantic search using vector similarity"""
        try:
            # Create query embedding
            query_embeddings = self.create_embeddings([query])
            query_vector = query_embeddings[0]
            
            # Vector search query
            search_body = {
                "size": limit,
                "query": {
                    "knn": {
                        "embedding_vector": {
                            "vector": query_vector,
                            "k": limit
                        }
                    }
                },
                "_source": {
                    "excludes": ["embedding_vector"]  # Don't return the large vector
                }
            }
            
            response = self.client.search(
                index=self.index_name,
                body=search_body
            )
            
            # Format results
            results = []
            for hit in response['hits']['hits']:
                source = hit['_source']
                results.append({
                    "job_id": hit['_id'],
                    "score": hit['_score'],
                    "metadata": {
                        "video_key": source.get("video_key", ""),
                        "bucket": source.get("bucket", ""),
                        "semantic_tags": source.get("semantic_tags", []),
                        "analysis_type": source.get("analysis_type", ""),
                        "has_labels": source.get("has_labels", False),
                        "has_text": source.get("has_text", False),
                        "has_blackframes": source.get("has_blackframes", False),
                        "timestamp": source.get("timestamp", "")
                    },
                    "document": source.get("semantic_content", "")
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    def get_video_count(self) -> int:
        """Get total number of videos in index"""
        try:
            response = self.client.count(index=self.index_name)
            return response['count']
        except Exception as e:
            logger.error(f"Failed to get video count: {e}")
            return 0
    
    def delete_video(self, job_id: str):
        """Delete video from index"""
        try:
            self.client.delete(index=self.index_name, id=job_id)
            logger.info(f"Deleted video {job_id} from OpenSearch")
        except Exception as e:
            logger.error(f"Failed to delete video: {e}")


class AWSChatBot:
    """
    AWS-Native ChatBot using Bedrock Claude 3
    """
    
    def __init__(self, vector_db: AWSVectorDB):
        self.vector_db = vector_db
        self.bedrock_client = boto3.client(
            'bedrock-runtime',
            region_name=os.environ.get('AWS_DEFAULT_REGION', 'eu-central-1')
        )
    
    def chat(self, user_query: str, context_limit: int = 5) -> Dict[str, Any]:
        """Process chat query with AWS Bedrock Claude"""
        try:
            # Vector search for relevant videos
            search_results = self.vector_db.semantic_search(user_query, limit=context_limit)
            
            if not search_results:
                return {
                    "response": "Entschuldigung, ich konnte keine Videos finden, die zu Ihrer Anfrage passen.",
                    "matched_videos": [],
                    "context_used": 0,
                    "query": user_query,
                    "timestamp": datetime.now().isoformat()
                }
            
            # Build context for Claude
            context_videos = []
            for result in search_results:
                metadata = result.get("metadata", {})
                video_info = {
                    "job_id": result["job_id"],
                    "video_key": metadata.get("video_key", ""),
                    "bucket": metadata.get("bucket", ""),
                    "similarity_score": round(result["score"], 3),
                    "analysis_type": metadata.get("analysis_type", "unknown"),
                    "semantic_tags": metadata.get("semantic_tags", []),
                    "has_labels": metadata.get("has_labels", False),
                    "has_text": metadata.get("has_text", False),
                    "has_blackframes": metadata.get("has_blackframes", False)
                }
                context_videos.append(video_info)
            
            # Generate response with Bedrock Claude
            response_text = self._generate_bedrock_response(user_query, context_videos)
            
            return {
                "response": response_text,
                "matched_videos": context_videos,
                "context_used": len(context_videos),
                "query": user_query,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Chat processing failed: {e}")
            return {
                "response": f"Entschuldigung, bei der Verarbeitung ist ein Fehler aufgetreten: {str(e)}",
                "matched_videos": [],
                "context_used": 0,
                "query": user_query,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _generate_bedrock_response(self, user_query: str, context_videos: List[Dict]) -> str:
        """Generate response using AWS Bedrock Claude 3"""
        try:
            # Build context
            context_text = "Verfügbare Video-Informationen:\n\n"
            for i, video in enumerate(context_videos, 1):
                video_name = video["video_key"].split("/")[-1] if "/" in video["video_key"] else video["video_key"]
                context_text += f"{i}. Video: {video_name}\n"
                context_text += f"   - Ähnlichkeit: {video['similarity_score']}\n"
                
                if video["semantic_tags"]:
                    context_text += f"   - Inhalte: {', '.join(video['semantic_tags'][:10])}\n"
                
                context_text += f"   - Job ID: {video['job_id'][:8]}...\n\n"
            
            system_prompt = """Du bist ein KI-Assistent für Video-Suche. 
            Beantworte Fragen über Videos basierend auf den verfügbaren Daten.
            Sei hilfsreich, präzise und antworte auf Deutsch."""
            
            user_prompt = f"""Benutzeranfrage: "{user_query}"

{context_text}

Bitte beantworte die Anfrage basierend auf den Video-Informationen."""
            
            # Call Bedrock Claude 3
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "temperature": 0.7,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": user_prompt}
                ]
            })
            
            response = self.bedrock_client.invoke_model(
                modelId="anthropic.claude-3-sonnet-20240229-v1:0",
                body=body
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['content'][0]['text']
            
        except Exception as e:
            logger.error(f"Bedrock response generation failed: {e}")
            return f"Fehler bei der KI-Antwort-Generierung: {str(e)}"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        return {
            "total_videos": self.vector_db.get_video_count(),
            "database_type": "aws_opensearch",
            "llm_provider": "aws_bedrock_claude3",
            "available": True,
            "last_updated": datetime.now().isoformat()
        }


# Singleton instances
_aws_vector_db = None
_aws_chatbot = None

def get_aws_vector_db() -> AWSVectorDB:
    """Get AWS Vector DB singleton"""
    global _aws_vector_db
    if _aws_vector_db is None:
        _aws_vector_db = AWSVectorDB()
    return _aws_vector_db

def get_aws_chatbot() -> AWSChatBot:
    """Get AWS ChatBot singleton"""
    global _aws_chatbot
    if _aws_chatbot is None:
        vector_db = get_aws_vector_db()
        _aws_chatbot = AWSChatBot(vector_db)
    return _aws_chatbot