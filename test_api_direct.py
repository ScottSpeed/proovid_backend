#!/usr/bin/env python3
"""
Test the API's smart_rag_search function directly to debug the 0 matches issue
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

async def test_api_search():
    """Test the API's smart_rag_search function directly"""
    print("🧪 TESTING API SMART_RAG_SEARCH DIRECTLY...")
    
    try:
        # Import the API function
        from api import smart_rag_search
        
        # Test BMW search
        print("\n--- Testing API smart_rag_search('BMW') ---")
        result = await smart_rag_search('BMW')
        print(f"API Result:\n{result}")
        
        print("\n" + "="*60)
        
        # Test G26 search  
        print("\n--- Testing API smart_rag_search('G26') ---")
        result = await smart_rag_search('G26')
        print(f"API Result:\n{result}")
        
        print("\n" + "="*60)
        
        # Test car search
        print("\n--- Testing API smart_rag_search('car') ---")
        result = await smart_rag_search('car')
        print(f"API Result:\n{result}")
        
    except Exception as e:
        print(f"❌ Error testing API: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api_search())