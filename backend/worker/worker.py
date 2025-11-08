import os
import json
import logging
import uuid
import boto3
import ast
import time
import sys
import signal
import threading
import tempfile
import zipfile
from decimal import Decimal
from agent import rekognition_detect_text, detect_blackframes, analyze_video_complete, rekognition_detect_labels

# Vector DB Integration
try:
    from cost_optimized_aws_vector import CostOptimizedAWSVectorDB
    VECTOR_DB_AVAILABLE = True
    print("[VECTOR-DB] Cost-optimized Vector DB module loaded successfully")
except ImportError as e:
    VECTOR_DB_AVAILABLE = False
    print(f"[VECTOR-DB] Warning: Vector DB not available: {e}")

DIRECT_MODE = True
TEST_MODE = False

def decimal_default(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def convert_decimals_to_native(data):
    """Recursively convert DynamoDB Decimal objects to native Python types"""
    if isinstance(data, dict):
        return {key: convert_decimals_to_native(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [convert_decimals_to_native(item) for item in data]
    elif isinstance(data, Decimal):
        return int(data) if data % 1 == 0 else float(data)
    else:
        return data

def process_zip_file(bucket: str, key: str, job_id: str):
    """Background task to download, unzip, and re-upload ZIP file contents"""
    try:
        logging.info(f"Starting unzip process for {key} (job {job_id})")
        
        # Update job status to processing (write to 'status' field only)
        current_time = int(time.time())
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('proov_jobs')
        table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "processing",
                ":updated_at": current_time
            }
        )
        
        s3 = boto3.client("s3")
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, "archive.zip")
            
            # Download ZIP file from S3
            logging.info(f"Downloading {key} from S3...")
            s3.download_file(bucket, key, zip_path)
            
            # Extract ZIP file
            extract_dir = os.path.join(temp_dir, "extracted")
            os.makedirs(extract_dir, exist_ok=True)
            
            extracted_files = []
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Get list of files in the ZIP
                file_list = zip_ref.namelist()
                logging.info(f"ZIP contains {len(file_list)} files")
                
                # Extract all files with password support
                try:
                    zip_ref.extractall(extract_dir)
                except RuntimeError as e:
                    if "password" in str(e).lower() or "encrypted" in str(e).lower():
                        logging.info("ZIP is encrypted, trying with default password")
                        zip_ref.extractall(extract_dir, pwd=b"EdgesG26_2020!")
                    else:
                        raise
                
                # Upload each extracted file back to S3 in same directory
                for file_name in file_list:
                    if not file_name.endswith('/'):  # Skip directories
                        local_file_path = os.path.join(extract_dir, file_name)
                        
                        # Create S3 key for extracted file in same directory as ZIP
                        key_parts = key.split('/')
                        if key.endswith('.zip'):
                            # Replace .zip with extracted filename
                            key_parts[-1] = file_name
                        else:
                            # Just add filename to directory
                            key_parts.append(file_name)
                        s3_key = '/'.join(key_parts)
                        
                        if os.path.isfile(local_file_path):
                            logging.info(f"Uploading {file_name} to S3 as {s3_key}")
                            s3.upload_file(local_file_path, bucket, s3_key)
                            extracted_files.append(s3_key)
            
            # Update job with results
            result_summary = f"Successfully extracted and uploaded {len(extracted_files)} files: {', '.join(extracted_files[:10])}"
            if len(extracted_files) > 10:
                result_summary += f" and {len(extracted_files) - 10} more..."
            
            current_time = int(time.time())
            table.update_item(
                Key={"job_id": job_id},
                UpdateExpression="SET #status = :status, results = :results, updated_at = :updated_at",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":status": "completed",
                    ":results": result_summary,
                    ":updated_at": current_time
                }
            )
            
            logging.info(f"Unzip job {job_id} completed successfully. Extracted {len(extracted_files)} files.")
            return {"status": "completed", "extracted_files": extracted_files}
    
    except Exception as e:
        logging.exception(f"Unzip job {job_id} failed: {str(e)}")
        
        # Update job with error status (use 'status' field)
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('proov_jobs')
        current_time = int(time.time())
        table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET #status = :status, results = :results, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "failed",
                ":results": f"Unzip failed: {str(e)}",
                ":updated_at": current_time
            }
        )
        return {"status": "failed", "error": str(e)}

def timeout_operation(operation, timeout_seconds):
    """Execute operation with timeout using threading."""
    result = [None, None]  # [result, error]
    
    def worker():
        try:
            result[0] = operation()
        except Exception as e:
            result[1] = e
    
    thread = threading.Thread(target=worker)
    thread.daemon = True
    thread.start()
    thread.join(timeout_seconds)
    
    if thread.is_alive():
        # Thread is still running, timeout occurred
        return None, TimeoutError("Operation timed out")
    
    return result[0], result[1]

def get_ddb_table():
    """Get DynamoDB table with extended timeout settings."""
    session = boto3.Session()
    
    # Create config with extended timeouts
    config = boto3.session.Config(
        read_timeout=60,
        connect_timeout=60,
        retries={'max_attempts': 3}
    )
    
    # Use the Gateway Endpoint for DynamoDB (no explicit endpoint needed)
    logging.info("Using DynamoDB Gateway Endpoint via VPC routing")
    
    ddb = session.resource('dynamodb', region_name='eu-central-1', config=config)
    table_name = os.environ.get("JOB_TABLE", "proov_jobs")
    return ddb.Table(table_name)

def get_sqs_client():
    """Get SQS client with extended timeout settings."""
    config = boto3.session.Config(
        read_timeout=60,
        connect_timeout=60,
        retries={'max_attempts': 3}
    )
    
    return boto3.client('sqs', region_name='eu-central-1', config=config)

def get_vector_db():
    """Get Vector DB instance for storing analysis results."""
    if not VECTOR_DB_AVAILABLE:
        logging.warning("Vector DB not available, skipping integration")
        return None
    
    try:
        vector_db = CostOptimizedAWSVectorDB()
        logging.info("Vector DB initialized successfully")
        return vector_db
    except Exception as e:
        logging.error(f"Failed to initialize Vector DB: {e}")
        return None

tools_map = {
    "analyze_video_complete": analyze_video_complete,
    "detect_blackframes": detect_blackframes,
    "rekognition_detect_text": rekognition_detect_text,
    "rekognition_detect_labels": rekognition_detect_labels,
    "process_zip_file": process_zip_file,
    "unzip_files": process_zip_file  # Alias for ZIP processing
}

def _process_messages(messages):
    """Process a list of SQS-style messages. Each message must contain a JSON body with job_id, tool and agent_args."""
    for msg in messages:
        try:
            body = msg.get("Body")
            if isinstance(body, str):
                data = json.loads(body)
            else:
                data = body
                
            job_id = data.get("job_id")
            tool_name = data.get("tool")
            agent_args = data.get("agent_args", {})
            
            # If tool is not at top level, try to extract from video object
            if not tool_name and "video" in data:
                video_data = data["video"]
                if isinstance(video_data, dict):
                    tool_name = video_data.get("tool")
                    
            logging.info("Processing message with job_id=%s, tool=%s", job_id, tool_name)
            
            if not job_id:
                logging.warning("Message missing job_id, skipping")
                continue
                
            # Fetch full job details from DynamoDB first
            try:
                # Add a small delay to allow the API to write the job details to DynamoDB
                time.sleep(2)
                logging.info("Fetching job details for %s from DynamoDB", job_id)
                
                # Use threaded timeout for DynamoDB get_item
                t = get_ddb_table()
                get_result, error = timeout_operation(
                    lambda: t.get_item(Key={"job_id": job_id}),
                    10  # 10 second timeout
                )
                
                if error:
                    if isinstance(error, TimeoutError):
                        logging.error("Timeout fetching job %s from DynamoDB", job_id)
                        continue
                    else:
                        logging.error("Error fetching job %s from DynamoDB: %s", job_id, error)
                        continue
                        
                job_item = get_result.get("Item")
                if not job_item:
                    logging.error("Job %s not found in DynamoDB", job_id)
                    continue

                # Convert Decimal objects to native Python types for JSON serialization
                job_item = convert_decimals_to_native(job_item)

                # --- Start of new simplified data extraction ---
                logging.info("Original job_item from DDB: %s", json.dumps(job_item, indent=2))

                # Definitive source for bucket, key, and file_url is the top-level of the job_item
                s3_bucket = job_item.get("s3_bucket")
                s3_key = job_item.get("s3_key")
                file_url = job_item.get("file_url")

                # If tool is not in the SQS message, get it from the job_item
                if not tool_name:
                    video_info = job_item.get("video", {})
                    if isinstance(video_info, str):
                        try:
                            video_info = json.loads(video_info)
                        except (json.JSONDecodeError, TypeError):
                            video_info = {}
                    tool_name = video_info.get("tool")

                # Fallback if tool is still not found
                if not tool_name:
                    tool_name = "analyze_video_complete"
                    logging.warning("Tool not found, falling back to default: %s", tool_name)

                # Validate that we have what we need to proceed
                if not s3_bucket or not s3_key:
                    logging.error("Job %s is missing s3_bucket or s3_key in DynamoDB item. Cannot process.", job_id)
                    continue

                agent_args = {
                    "job_id": job_id,
                    "s3_bucket": s3_bucket,
                    "s3_key": s3_key,
                    "file_url": file_url
                }
                
                logging.info(
                    "Job details processed: job_id=%s, tool=%s, bucket=%s, key=%s, file_url=%s",
                    job_id, tool_name, s3_bucket, s3_key, file_url
                )
                # --- End of new simplified data extraction ---

            except Exception as e:
                logging.error("Failed to fetch and process job details for %s: %s", job_id, e)
                continue
            
            # Update status to "running"
            try:
                t = get_ddb_table()
                updated_at = int(time.time())
                
                # Use threaded timeout for DynamoDB update_item (preserves other fields)
                result_op, error = timeout_operation(
                    lambda: t.update_item(
                        Key={"job_id": job_id},
                        UpdateExpression="SET #status = :status, #updated_at = :updated_at",
                        ExpressionAttributeNames={
                            "#status": "status",
                            "#updated_at": "updated_at"
                        },
                        ExpressionAttributeValues={
                            ":status": "running",
                            ":updated_at": updated_at
                        }
                    ),
                    10  # 10 second timeout
                )
                
                if error:
                    if isinstance(error, TimeoutError):
                        logging.error("Timeout updating job %s status to running", job_id)
                    else:
                        logging.error("Error updating job %s status to running: %s", job_id, error)
                else:
                    logging.info("Updated job %s status to running", job_id)
            except Exception:
                logging.exception("Failed to write running status to DynamoDB")
            
            # Process the job
            try:
                if DIRECT_MODE and tool_name in tools_map:
                    # Direct tool execution without Strands framework
                    logging.info("Using DIRECT_MODE for tool execution: %s", tool_name)
                    
                    tool_function = tools_map[tool_name]

                    # Extract bucket and key from file_url
                    file_url = agent_args.get("file_url", "")
                    # Direct tool execution without Strands framework
                    logging.info("Using DIRECT_MODE for tool execution: %s", tool_name)
                    
                    tool_function = tools_map[tool_name]

                    # Extract bucket and key from file_url
                    file_url = agent_args.get("file_url", "")
                    logging.info(f"Starting analysis for URL: {file_url}")
                    
                    bucket = agent_args.get("s3_bucket")
                    key = agent_args.get("s3_key")
                    
                    if not bucket or not key:
                        if file_url:
                            # Parse S3 URL to extract bucket and key
                            if file_url.startswith("s3://"):
                                s3_path = file_url[5:]  # Remove s3://
                                parts = s3_path.split("/", 1)
                                if len(parts) == 2:
                                    bucket, key = parts
                            elif "s3" in file_url and ".amazonaws.com" in file_url:
                                # Parse HTTPS S3 URL: https://bucket.s3.region.amazonaws.com/key
                                import re
                                match = re.match(r'https://([^.]+)\.s3\.[^.]+\.amazonaws\.com/(.+)', file_url)
                                if match:
                                    bucket, key = match.groups()
                    
                    logging.info(f"Extracted bucket: {bucket}, key: {key}")

                    if not bucket or not key:
                        raise ValueError("Could not determine bucket and key for analysis")
                    
                    # Call the tool function
                    if tool_name == "detect_blackframes":
                         result = tool_function(bucket=bucket, s3_key=key)
                    else:
                         result = tool_function(bucket=bucket, video=key)

                    result_data = json.loads(result) if isinstance(result, str) else result
                    logging.info("=== TOOL EXECUTION RESULT ===")
                    logging.info("Tool: %s", tool_name)
                    logging.info("Raw result type: %s", type(result))
                    logging.info("Raw result content: %s", str(result)[:500] + "..." if len(str(result)) > 500 else str(result))
                    logging.info("Parsed result_data type: %s", type(result_data))
                    logging.info("Parsed result_data: %s", json.dumps(result_data, indent=2) if isinstance(result_data, dict) else str(result_data))
                    logging.info("============================")
                    
                    logging.info("Direct tool execution completed successfully")

                    # Assign result for all cases
                    if 'result_data' in locals():
                        result = json.dumps(result_data, indent=2)
                    else:
                        raise ValueError("Result data was not generated")
                
                else:
                    # Fallback to DIRECT_MODE since agent framework is disabled
                    logging.warning("Agent framework requested but not available, falling back to DIRECT_MODE")
                    if tool_name in tools_map:
                        tool_function = tools_map[tool_name]
                        bucket = agent_args.get("s3_bucket")
                        key = agent_args.get("s3_key")
                        
                        if tool_name == "detect_blackframes":
                            result = tool_function(bucket=bucket, s3_key=key)
                        else:
                            result = tool_function(bucket=bucket, video=key)
                    else:
                        raise ValueError(f"Unknown tool: {tool_name}")
                    
                logging.info("Job %s completed successfully", job_id)
                
            except Exception as e:
                logging.error("Job %s failed: %s", job_id, e)
                
                # Update status to "error"
                try:
                    t = get_ddb_table()
                    updated_at = int(time.time())
                    
                    # Use threaded timeout for DynamoDB update_item
                    result_op, error = timeout_operation(
                        lambda: t.update_item(
                            Key={"job_id": job_id},
                            UpdateExpression="SET #status = :status, #updated_at = :updated_at, #result = :result",
                            ExpressionAttributeNames={
                                "#status": "status",
                                "#updated_at": "updated_at",
                                "#result": "result"
                            },
                            ExpressionAttributeValues={
                                ":status": "error",
                                ":updated_at": updated_at,
                                ":result": str(e)
                            }
                        ),
                        10  # 10 second timeout
                    )
                    
                    if error:
                        if isinstance(error, TimeoutError):
                            logging.error("Timeout updating job %s status to error", job_id)
                        else:
                            logging.error("Error updating job %s status to error: %s", job_id, error)
                    else:
                        logging.info("Updated job %s status to error", job_id)
                except Exception:
                    logging.exception("Failed to write error status to DynamoDB")
                continue
                
            # Update status to "done" and preserve video information
            try:
                t = get_ddb_table()
                updated_at = int(time.time())

                analysis_data = {}
                if isinstance(result, str):
                    try:
                        analysis_data = json.loads(result)
                    except json.JSONDecodeError:
                        logging.warning("Result is not a valid JSON string. Storing as is.")
                        analysis_data = {"raw_result": result}
                elif isinstance(result, dict):
                    analysis_data = result
                
                # Get the original video info from the job item
                video_info = job_item.get("video", {})
                if isinstance(video_info, str):
                    try:
                        video_info = json.loads(video_info)
                    except json.JSONDecodeError:
                        video_info = {}

                # Ensure video_info is a dictionary
                if not isinstance(video_info, dict):
                    video_info = {}

                # Populate video_info with definitive data from job_item
                video_info["bucket"] = job_item.get("s3_bucket")
                video_info["key"] = job_item.get("s3_key")
                video_info["s3_url"] = job_item.get("file_url")
                if video_info.get("key"):
                    video_info["filename"] = os.path.basename(video_info["key"])
                else:
                    video_info["filename"] = "Unknown"
                video_info["tool"] = tool_name

                # Preserve the original video information and add extracted data
                item = {
                    "job_id": job_id, 
                    "status": "done", 
                    "result": json.dumps(analysis_data), # Store the full analysis as a string - BACK TO ORIGINAL FIELD NAME
                    "updated_at": updated_at,
                    "created_at": job_item.get("created_at", int(time.time())),  # Preserve original created_at
                    "s3_bucket": job_item.get("s3_bucket"),  # Preserve original S3 info
                    "s3_key": job_item.get("s3_key"),
                    "file_url": job_item.get("file_url"),
                    "video": job_item.get("video"),  # Preserve original video field
                    "video_info": video_info
                }
                
                # CRITICAL: Preserve user isolation fields for multi-tenant support
                if job_item.get("user_id"):
                    item["user_id"] = job_item["user_id"]
                if job_item.get("user_email"):
                    item["user_email"] = job_item["user_email"]
                if job_item.get("session_id"):
                    item["session_id"] = job_item["session_id"]

                # Extract summary and other fields to the top level
                summary = analysis_data.get("summary", {})
                item["summary"] = {
                    "blackframes_count": summary.get("blackframes_count", 0),
                    "text_detections_count": summary.get("text_detections_count", 0),
                    "analysis_type": analysis_data.get("analysis_type", "basic")
                }
                item["has_blackframes"] = summary.get("blackframes_count", 0) > 0
                item["has_text_detection"] = summary.get("text_detections_count", 0) > 0
                
                # Debug logging before writing to DynamoDB
                logging.info("=== FINAL ITEM TO WRITE TO DYNAMODB ===")
                logging.info("Job ID: %s", job_id)
                logging.info("Analysis data type: %s", type(analysis_data))
                logging.info("Analysis data content: %s", json.dumps(analysis_data, indent=2) if analysis_data else "EMPTY")
                logging.info("Video info: %s", json.dumps(video_info, indent=2))
                logging.info("Final item keys: %s", list(item.keys()))
                logging.info("==========================================")
                
                # Store in Vector DB for semantic search
                try:
                    vector_db = get_vector_db()
                    if vector_db and analysis_data:
                        video_metadata = {
                            "key": video_info.get("key", ""),
                            "bucket": video_info.get("bucket", ""),
                            "job_id": job_id,
                            "filename": video_info.get("filename", ""),
                            "s3_url": video_info.get("s3_url", "")
                        }
                        
                        vector_db.store_video_analysis(job_id, video_metadata, analysis_data)
                        logging.info("✅ STORED IN VECTOR DB: Job %s with %d labels, %d text detections", 
                                   job_id, 
                                   len(analysis_data.get("labels", [])),
                                   len(analysis_data.get("text_detections", [])))
                    else:
                        logging.warning("❌ Vector DB not available or no analysis data to store")
                except Exception as e:
                    logging.error("❌ Failed to store in Vector DB: %s", e)
                
                result_op, error = timeout_operation(
                    lambda: t.put_item(Item=item),
                    10  # 10 second timeout
                )
                
                if error:
                    if isinstance(error, TimeoutError):
                        logging.error("Timeout updating job %s status to done", job_id)
                    else:
                        logging.error("Error updating job %s status to done: %s", job_id, error)
                else:
                    logging.info("Updated job %s status to done with file_url: %s", job_id, item.get("video_info", {}).get("s3_url", "N/A"))
            except Exception:
                logging.exception("Failed to write done status to DynamoDB")
        except Exception as e:
            logging.exception("Error processing message: %s", e)
            try:
                t = get_ddb_table()
                updated_at = int(time.time())
                
                # Use threaded timeout for DynamoDB update_item
                result_op, error = timeout_operation(
                    lambda: t.update_item(
                        Key={"job_id": job_id or "unknown"},
                        UpdateExpression="SET #status = :status, #updated_at = :updated_at, #result = :result",
                        ExpressionAttributeNames={
                            "#status": "status", 
                            "#updated_at": "updated_at",
                            "#result": "result"
                        },
                        ExpressionAttributeValues={
                            ":status": "error",
                            ":updated_at": updated_at,
                            ":result": str(e)
                        }
                    ),
                    10  # 10 second timeout
                )
                
                if error:
                    if isinstance(error, TimeoutError):
                        logging.error("Timeout updating job %s status to error", job_id or "unknown")
                    else:
                        logging.error("Error updating job %s status to error: %s", job_id or "unknown", error)
                else:
                    logging.info("Updated job %s status to error", job_id or "unknown")
            except Exception:
                logging.exception("Failed to write error status to DynamoDB")

def main():
    logging.basicConfig(level=logging.INFO)
    
    # Add diagnostic logging
    logging.info("=== Worker starting with configuration ===")
    logging.info("AWS Region: %s", os.environ.get("AWS_DEFAULT_REGION", "eu-central-1"))
    logging.info("Job Table: %s", os.environ.get("JOB_TABLE", "proov_jobs"))
    logging.info("SQS Queue: %s", os.environ.get("SQS_QUEUE_URL", "Not set"))
    logging.info("Direct Mode: %s", DIRECT_MODE)
    logging.info("Test Mode: %s", TEST_MODE)
    
    # Test connectivity
    try:
        sqs = get_sqs_client()
        sqs.list_queues()
        logging.info("SQS connectivity test successful")
    except Exception as e:
        logging.error("SQS connectivity test failed: %s", e)
        
    try:
        ddb = get_ddb_table()
        logging.info("DynamoDB table connection created successfully")
    except Exception as e:
        logging.error("DynamoDB connection test failed: %s", e)
    
    # If JOB_ID is provided, run a single-job invocation (useful for manual run-task overrides)
    job_id = os.environ.get("JOB_ID")
    if job_id:
        tool_name = os.environ.get("AGENT_TOOL")
        agent_args_raw = os.environ.get("AGENT_ARGS")
        if not tool_name or not agent_args_raw:
            raise RuntimeError("JOB_ID mode requires AGENT_TOOL and AGENT_ARGS environment variables")
        messages = [ {"Body": json.dumps({"job_id": job_id, "tool": tool_name, "agent_args": json.loads(agent_args_raw)}) } ]
        # process single message
        _process_messages(messages)
        return

    # Otherwise run as a long-lived worker polling SQS
    sqs_url = os.environ.get("SQS_QUEUE_URL") or os.environ.get("SQS_URL")
    if not sqs_url:
        raise RuntimeError("SQS_QUEUE_URL not set for worker poll mode")
    sqs = get_sqs_client()
    logging.info("Starting SQS poll loop for queue %s", sqs_url)
    
    while True:
        try:
            logging.info("Polling SQS for messages...")
            resp = sqs.receive_message(QueueUrl=sqs_url, MaxNumberOfMessages=5, WaitTimeSeconds=10, VisibilityTimeout=300)
            messages = resp.get("Messages", [])
            if not messages:
                logging.info("No messages received, continuing poll loop")
                continue
            
            logging.info("Received %d messages from SQS", len(messages))
            _process_messages(messages)
            
            # delete processed messages
            for m in messages:
                try:
                    sqs.delete_message(QueueUrl=sqs_url, ReceiptHandle=m.get("ReceiptHandle"))
                    logging.info("Deleted message from SQS queue")
                except Exception:
                    logging.exception("Failed to delete message from SQS")
                    
        except KeyboardInterrupt:
            logging.info("Worker received shutdown signal")
            break
        except Exception:
            logging.exception("Error polling SQS; retrying after short backoff")
            time.sleep(5)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.exception("Worker crashed: %s", e)
        sys.exit(1)
