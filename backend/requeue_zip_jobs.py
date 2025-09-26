#!/usr/bin/env python3

import json
import subprocess
import requests

def requeue_zip_jobs():
    """Re-queue all ZIP jobs that are stuck in 'queued' status"""
    
    # Get all jobs from backend
    response = requests.get("http://ui-proov-alb-1535367426.eu-central-1.elb.amazonaws.com/jobs")
    jobs = response.json()
    
    # Filter ZIP jobs that are still queued
    zip_jobs = [job for job in jobs if 
                job.get('video', {}).get('tool') == 'unzip_files' and 
                job.get('status') == 'queued']
    
    print(f"Found {len(zip_jobs)} ZIP jobs in 'queued' status")
    
    if not zip_jobs:
        print("No ZIP jobs to re-queue")
        return
    
    sqs_url = "https://sqs.eu-central-1.amazonaws.com/851725596604/proov-worker-queue"
    requeued_count = 0
    
    for job in zip_jobs:
        try:
            job_id = job['job_id']
            video = job.get('video', {})
            bucket = video.get('bucket', job.get('s3_bucket', ''))
            key = video.get('key', job.get('s3_key', ''))
            
            if not bucket or not key:
                print(f"Skipping job {job_id}: missing bucket or key")
                continue
            
            # Construct message for SQS
            file_url = f"https://{bucket}.s3.eu-central-1.amazonaws.com/{key}"
            agent_args = {
                "file_url": file_url,
                "bucket": bucket,
                "s3_key": key
            }
            
            body = {
                "job_id": job_id,
                "tool": "unzip_files", 
                "agent_args": agent_args,
            }
            
            # Use AWS CLI to send to SQS
            cmd = [
                "aws", "sqs", "send-message",
                "--queue-url", sqs_url,
                "--message-body", json.dumps(body)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"Re-queued job {job_id} for file {key}")
                requeued_count += 1
            else:
                print(f"Failed to re-queue job {job_id}: {result.stderr}")
            
        except Exception as e:
            print(f"Failed to re-queue job {job.get('job_id', 'unknown')}: {e}")
    
    print(f"\nSuccessfully re-queued {requeued_count} ZIP jobs")

if __name__ == "__main__":
    requeue_zip_jobs()

if __name__ == "__main__":
    requeue_zip_jobs()