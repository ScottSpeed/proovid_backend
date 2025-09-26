"""
Standalone Job Management API als temporärer Hotfix
Kann als separate Lambda-Funktion oder direkt deployed werden
"""
import json
import boto3
import os
from datetime import datetime
import uuid

# DynamoDB Setup
dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
sqs = boto3.client('sqs', region_name='eu-central-1')

JOB_TABLE = "proov_jobs"
QUEUE_URL = "https://sqs.eu-central-1.amazonaws.com/851725596604/proov-worker-queue"

def delete_job(job_id: str):
    """Delete a job from DynamoDB"""
    try:
        table = dynamodb.Table(JOB_TABLE)
        response = table.delete_item(
            Key={'job_id': job_id},
            ReturnValues='ALL_OLD'
        )
        return response.get('Attributes') is not None
    except Exception as e:
        print(f"Error deleting job {job_id}: {e}")
        return False

def restart_job(job_id: str):
    """Restart a job by updating status and sending to SQS"""
    try:
        table = dynamodb.Table(JOB_TABLE)
        
        # Update job status to 'queued'
        response = table.update_item(
            Key={'job_id': job_id},
            UpdateExpression='SET job_status = :status, updated_at = :updated',
            ExpressionAttributeValues={
                ':status': 'queued',
                ':updated': datetime.utcnow().isoformat()
            },
            ReturnValues='ALL_NEW'
        )
        
        job = response.get('Attributes')
        if not job:
            return False
            
        # Send job to SQS queue
        message = {
            'job_id': job_id,
            'video_url': job.get('video_url', ''),
            'user_id': job.get('user_id', '')
        }
        
        sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        
        return True
    except Exception as e:
        print(f"Error restarting job {job_id}: {e}")
        return False

def create_test_job():
    """Create a test job for testing purposes"""
    try:
        job_id = str(uuid.uuid4())
        table = dynamodb.Table(JOB_TABLE)
        
        job = {
            'job_id': job_id,
            'user_id': 'test_user',
            'video_url': 's3://ui-proov-uploads/Sample.mp4',
            'job_status': 'queued',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        table.put_item(Item=job)
        
        # Send to SQS
        message = {
            'job_id': job_id,
            'video_url': job['video_url'],
            'user_id': job['user_id']
        }
        
        sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        
        return job_id
    except Exception as e:
        print(f"Error creating test job: {e}")
        return None

# API Handler für Lambda oder direkten Aufruf
def lambda_handler(event, context):
    """Lambda handler für API Gateway Events"""
    method = event.get('httpMethod', '')
    path = event.get('path', '')
    
    if method == 'DELETE' and path.startswith('/jobs/'):
        job_id = path.split('/')[-1]
        success = delete_job(job_id)
        return {
            'statusCode': 200 if success else 404,
            'body': json.dumps({'success': success})
        }
    
    elif method == 'POST' and path.endswith('/restart'):
        job_id = path.split('/')[-2]
        success = restart_job(job_id)
        return {
            'statusCode': 200 if success else 404,
            'body': json.dumps({'success': success})
        }
    
    elif method == 'POST' and path == '/jobs/test':
        job_id = create_test_job()
        return {
            'statusCode': 200 if job_id else 500,
            'body': json.dumps({'job_id': job_id})
        }
    
    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Not found'})
    }

if __name__ == "__main__":
    # Test the functions
    print("Creating test job...")
    test_job_id = create_test_job()
    print(f"Created test job: {test_job_id}")
    
    if test_job_id:
        print(f"Restarting job {test_job_id}...")
        restart_success = restart_job(test_job_id)
        print(f"Restart success: {restart_success}")
        
        print(f"Deleting job {test_job_id}...")
        delete_success = delete_job(test_job_id)
        print(f"Delete success: {delete_success}")
