#!/usr/bin/env python3
"""
Quick test script to check if chatbot is working
"""
import os
import asyncio
import sys
sys.path.append('backend')

async def test_chatbot():
    from api import call_bedrock_chatbot
    
    print("🤖 Testing Bedrock ChatBot...")
    
    # Test with simple message
    try:
        response = await call_bedrock_chatbot("Zeig mir Videos mit Autos", "test-user")
        print(f"✅ Response: {response[:200]}...")
        
        # Test BMW query
        response2 = await call_bedrock_chatbot("Gibt es Videos mit BMW?", "test-user")
        print(f"✅ BMW Response: {response2[:200]}...")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_chatbot())