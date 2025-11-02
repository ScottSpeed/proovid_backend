#!/usr/bin/env python3
"""
Debug Vector DB search to find why BMW queries return 0 results
"""

import sys
sys.path.append('backend')

from cost_optimized_aws_vector import CostOptimizedAWSVectorDB, CostOptimizedChatBot
import json
import os

# Set AWS region
os.environ['AWS_DEFAULT_REGION'] = 'eu-central-1'

def debug_vector_search():
    print("🔍 DEBUGGING VECTOR DB SEARCH...")
    
    # Initialize Vector DB
    vector_db = CostOptimizedAWSVectorDB()
    print("✅ Vector DB initialized")
    
    # Test direct semantic search
    print("\n🎯 TESTING DIRECT SEMANTIC_SEARCH:")
    
    test_queries = ["BMW", "bmw", "G26", "car", "Car"]
    
    for query in test_queries:
        print(f"\n--- Testing query: '{query}' ---")
        results = vector_db.semantic_search(query, limit=5)
        print(f"Results: {len(results)}")
        
        for i, result in enumerate(results[:2]):  # Show first 2
            print(f"  {i+1}. Job: {result.get('job_id', 'N/A')[:8]}...")
            print(f"     Score: {result.get('score', 0)}")
            print(f"     Content: {result.get('document', '')[:100]}...")
            metadata = result.get('metadata', {})
            print(f"     Video: {metadata.get('video_key', 'N/A')}")
    
    # Test ChatBot (which might have different behavior)
    print("\n🤖 TESTING CHATBOT:")
    chatbot = CostOptimizedChatBot(vector_db)
    
    for query in ["BMW", "G26"]:
        print(f"\n--- ChatBot query: '{query}' ---")
        response = chatbot.chat(query, context_limit=3)
        print(f"Response: {response.get('response', '')[:100]}...")
        print(f"Matched videos: {len(response.get('matched_videos', []))}")
        
        for video in response.get('matched_videos', [])[:1]:
            print(f"  Video: {video.get('video_key', 'N/A')}")
            print(f"  Score: {video.get('similarity_score', 0)}")

    # Check DynamoDB items directly
    print("\n📊 CHECKING DYNAMODB ITEMS DIRECTLY:")
    try:
        # Simple scan to see what's in the table
        scan_response = vector_db.table.scan(Limit=5)
        items = scan_response.get('Items', [])
        print(f"Total items scanned: {len(items)}")
        
        for i, item in enumerate(items):
            print(f"\n  Item {i+1}:")
            print(f"    Job ID: {item.get('job_id', 'N/A')}")
            print(f"    S3 Key: {item.get('s3_key', 'N/A')}")
            print(f"    Status: {item.get('status', 'N/A')}")
            print(f"    Has searchable_content: {bool(item.get('searchable_content'))}")
            print(f"    Has semantic_tags: {bool(item.get('semantic_tags'))}")
            
            # Check content for BMW mentions
            content = item.get('searchable_content', '')
            if 'bmw' in content.lower() or 'g26' in content.lower():
                print(f"    ✅ CONTAINS BMW/G26 in content!")
                print(f"    Content: {content[:150]}...")
            else:
                print(f"    ❌ No BMW/G26 found in content")
    
    except Exception as e:
        print(f"❌ Error scanning DynamoDB: {e}")
    
    print("\n✅ Debug complete!")

if __name__ == "__main__":
    debug_vector_search()