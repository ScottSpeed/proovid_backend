#!/usr/bin/env python3
"""
Test script für die neuen Features:
1. Vector Database Integration
2. ChatBot mit RAG
3. Label Detection
"""

import os
import sys
import json
import logging

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)
print(f"Added to Python path: {backend_path}")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_vector_db():
    """Test Vector Database functionality"""
    print("🗄️ Testing Vector Database...")
    
    try:
        from vector_db import VideoVectorDB
        
        # Test ChromaDB (default)
        vector_db = VideoVectorDB(db_type="chromadb")
        
        # Test storing a sample video analysis
        job_id = "test-job-12345"
        video_metadata = {
            "bucket": "test-bucket",
            "key": "test-video.mp4",
            "tool": "rekognition_detect_labels"
        }
        
        analysis_results = {
            "analysis_type": "complete",
            "label_detection": {
                "semantic_tags": ["Car", "Person", "Road", "Sky", "Building"],
                "unique_labels_count": 5,
                "total_labels_detected": 25
            },
            "text_detection": {
                "text_detections": [
                    {"text": "BMW", "confidence": 0.95, "timestamp": 5.2}
                ],
                "count": 1
            }
        }
        
        # Store analysis
        vector_db.store_video_analysis(job_id, video_metadata, analysis_results)
        print("✅ Successfully stored video analysis in vector DB")
        
        # Test semantic search
        search_results = vector_db.semantic_search("cars and vehicles", limit=5)
        print(f"✅ Semantic search returned {len(search_results)} results")
        
        # Get database stats
        count = vector_db.get_video_count()
        print(f"✅ Database contains {count} videos")
        
        return True
        
    except Exception as e:
        print(f"❌ Vector DB test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_chatbot():
    """Test ChatBot functionality"""
    print("\n🤖 Testing ChatBot...")
    
    try:
        from chatbot import VideoRAGChatBot
        from vector_db import get_vector_db
        
        # Get vector DB instance
        vector_db = get_vector_db()
        
        # Test chatbot (will fail without API keys, but we can test initialization)
        chatbot = VideoRAGChatBot(vector_db=vector_db, llm_provider="anthropic")
        
        # Test getting suggestions
        suggestions = chatbot.get_suggestions()
        print(f"✅ ChatBot provides {len(suggestions)} example queries")
        
        # Test getting stats
        stats = chatbot.get_stats()
        print(f"✅ ChatBot stats: {stats}")
        
        print("⚠️  Note: Full chat functionality requires ANTHROPIC_API_KEY environment variable")
        
        return True
        
    except Exception as e:
        print(f"❌ ChatBot test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_label_detection():
    """Test Label Detection in Agent"""
    print("\n🏷️ Testing Label Detection...")
    
    try:
        # Import agent
        from worker.agent import rekognition_detect_labels
        
        print("✅ Label detection tool imported successfully")
        print("⚠️  Note: Full label detection requires AWS credentials and video files")
        
        return True
        
    except Exception as e:
        print(f"❌ Label detection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Proovid Feature Tests")
    print("=" * 50)
    
    tests = [
        ("Vector Database", test_vector_db),
        ("ChatBot", test_chatbot),
        ("Label Detection", test_label_detection)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    print("\n📊 Test Results:")
    print("=" * 50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! Your new features are ready to use.")
    else:
        print("⚠️  Some tests failed. Check the error messages above.")
    
    print("\n🛠️  Next Steps:")
    print("1. Set ANTHROPIC_API_KEY environment variable for full ChatBot functionality")
    print("2. Ensure AWS credentials are configured for label detection")
    print("3. Start the backend server: uvicorn api:app --reload")
    print("4. Start the frontend: npm run dev")
    print("5. Test the new features in the web interface!")

if __name__ == "__main__":
    main()