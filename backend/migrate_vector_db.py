import boto3
import json
from cost_optimized_aws_vector import CostOptimizedAWSVectorDB

def migrate_existing_data():
    try:
        print("[MIGRATION] Starting Vector DB population...")
        
        # Initialize Vector DB
        vector_db = CostOptimizedAWSVectorDB()
        print("[MIGRATION] Vector DB initialized")
        
        # Get DynamoDB data
        dynamodb = boto3.resource("dynamodb", region_name="eu-central-1")
        table = dynamodb.Table("proov_jobs")
        
        response = table.scan(Limit=10)
        jobs = response.get("Items", [])
        
        migrated = 0
        for job in jobs:
            if job.get("status") == "done" and "result" in job:
                try:
                    job_id = job["job_id"]
                    result_data = json.loads(job["result"]) if isinstance(job["result"], str) else job["result"]
                    
                    video_metadata = {
                        "key": job.get("s3_key", ""),
                        "bucket": job.get("s3_bucket", "proovid-results"),
                        "job_id": job_id
                    }
                    
                    vector_db.store_video_analysis(job_id, video_metadata, result_data)
                    print(f"[MIGRATION] Migrated: {job_id}")
                    migrated += 1
                except Exception as e:
                    print(f"[MIGRATION] Error migrating {job_id}: {e}")
        
        print(f"[MIGRATION] Complete! Migrated {migrated} videos")
        
        # Test search
        results = vector_db.semantic_search("car", limit=3)
        print(f"[TEST] Search results: {len(results)} matches")
        
    except Exception as e:
        print(f"[MIGRATION] Failed: {e}")

if __name__ == "__main__":
    migrate_existing_data()
