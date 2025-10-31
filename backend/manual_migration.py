#!/usr/bin/env python3
"""
Manual Vector DB Migration Script
Reads analyzed video data from DynamoDB and populates Vector DB
"""

import boto3
import json
import sys
import os
from decimal import Decimal

# Add current directory to path for imports
sys.path.append('/app')
sys.path.append('.')

try:
    from cost_optimized_aws_vector import CostOptimizedAWSVectorDB
    print("✅ Vector DB module imported successfully")
except ImportError as e:
    print(f"❌ Vector DB import failed: {e}")
    sys.exit(1)

def decimal_default(obj):
    """JSON serializer for DynamoDB Decimal objects"""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def convert_decimals_to_native(data):
    """Convert DynamoDB Decimal objects to native Python types"""
    if isinstance(data, dict):
        return {key: convert_decimals_to_native(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [convert_decimals_to_native(item) for item in data]
    elif isinstance(data, Decimal):
        return int(data) if data % 1 == 0 else float(data)
    else:
        return data

def migrate_existing_videos():
    """Migrate existing analyzed videos to Vector DB"""
    try:
        print("🚀 [MIGRATION] Starting Vector DB population...")
        
        # Initialize Vector DB
        vector_db = CostOptimizedAWSVectorDB()
        print("✅ [MIGRATION] Vector DB initialized")
        
        # Get DynamoDB data
        dynamodb = boto3.resource("dynamodb", region_name="eu-central-1")
        table = dynamodb.Table("proov_jobs")
        print("✅ [MIGRATION] DynamoDB connected")
        
        # Scan for completed jobs
        response = table.scan(
            FilterExpression="attribute_exists(#result) AND #status = :status",
            ExpressionAttributeNames={"#result": "result", "#status": "status"},
            ExpressionAttributeValues={":status": "done"},
            Limit=10
        )
        
        jobs = response.get("Items", [])
        print(f"📊 [MIGRATION] Found {len(jobs)} completed jobs")
        
        migrated_count = 0
        
        for job in jobs:
            try:
                # Convert DynamoDB format to native Python
                job = convert_decimals_to_native(job)
                
                job_id = job["job_id"]
                s3_key = job.get("s3_key", "")
                s3_bucket = job.get("s3_bucket", "proovid-results")
                
                # Parse analysis results
                result_raw = job.get("result", "{}")
                if isinstance(result_raw, str):
                    analysis_results = json.loads(result_raw)
                else:
                    analysis_results = result_raw
                
                if not analysis_results:
                    print(f"⚠️  [MIGRATION] No analysis results for {job_id}, skipping")
                    continue
                
                # Create video metadata
                video_metadata = {
                    "key": s3_key,
                    "bucket": s3_bucket,
                    "job_id": job_id,
                    "filename": os.path.basename(s3_key) if s3_key else "unknown.mp4"
                }
                
                # Store in Vector DB
                vector_db.store_video_analysis(job_id, video_metadata, analysis_results)
                
                # Extract some details for logging
                labels = analysis_results.get("labels", [])
                text_detections = analysis_results.get("text_detections", [])
                
                print(f"✅ [MIGRATION] Migrated {job_id}: {len(labels)} labels, {len(text_detections)} text detections")
                migrated_count += 1
                
            except Exception as e:
                print(f"❌ [MIGRATION] Error migrating {job_id}: {e}")
                continue
        
        print(f"🎉 [MIGRATION] Complete! Migrated {migrated_count} videos to Vector DB")
        
        # Test search to verify migration
        try:
            print("\n🔍 [TEST] Testing Vector DB search...")
            
            # Test searches
            test_queries = ["BMW", "car", "vehicle", "G26"]
            
            for query in test_queries:
                results = vector_db.semantic_search(query, limit=3)
                print(f"🔍 [TEST] '{query}' search: {len(results)} matches")
                
                for i, result in enumerate(results[:2]):  # Show first 2 results
                    filename = result.get("filename", "unknown")
                    score = result.get("score", 0)
                    print(f"   {i+1}. {filename} (score: {score:.3f})")
            
            print("✅ [TEST] Vector DB search test completed")
            
        except Exception as e:
            print(f"❌ [TEST] Search test failed: {e}")
        
        return migrated_count
        
    except Exception as e:
        print(f"💥 [MIGRATION] Migration failed: {e}")
        return 0

if __name__ == "__main__":
    print("🔥 Manual Vector DB Migration Starting...")
    count = migrate_existing_videos()
    print(f"🏁 Migration finished: {count} videos migrated")
    sys.exit(0 if count > 0 else 1)