import json
import os
import uuid
import boto3
from datetime import datetime, timezone
import jwt
from typing import Dict, Any

# Environment variables
DDB_TABLE_NAME = os.environ.get('DDB_TABLE_NAME', 'ProovJobs')
SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-123')
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# AWS clients
dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

def cors_headers():
    """Return CORS headers"""
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }

def lambda_response(status_code: int, body: Dict[str, Any], headers: Dict[str, str] = None):
    """Create Lambda response"""
    response_headers = cors_headers()
    if headers:
        response_headers.update(headers)
    
    return {
        'statusCode': status_code,
        'headers': response_headers,
        'body': json.dumps(body)
    }

def login_handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle login"""
    try:
        body = json.loads(event.get('body', '{}'))
        username = body.get('username')
        password = body.get('password')
        
        print(f"Login attempt: username={username}")
        print(f"Expected username: {ADMIN_USERNAME}, password: {ADMIN_PASSWORD}")
        
        if not username or not password:
            return lambda_response(400, {'error': 'Username and password required'})
        
        # Simple admin check
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            # Generate JWT
            token = jwt.encode({
                'username': username,
                'exp': (datetime.now(timezone.utc).timestamp() + 3600)  # 1 hour
            }, JWT_SECRET, algorithm='HS256')
            
            print(f"Login successful, token generated")
            return lambda_response(200, {'access_token': token})
        else:
            print("Invalid credentials provided")
            return lambda_response(401, {'error': 'Invalid credentials'})
            
    except Exception as e:
        print(f"Login error: {str(e)}")
        return lambda_response(500, {'error': 'Internal server error'})

def verify_jwt(token: str) -> Dict[str, Any]:
    """Verify JWT token"""
    try:
        if token.startswith('Bearer '):
            token = token[7:]
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception as e:
        print(f"JWT verification error: {str(e)}")
        return None

def get_jobs_handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """Get all jobs"""
    try:
        # Verify auth
        auth_header = event.get('headers', {}).get('Authorization', '')
        user = verify_jwt(auth_header)
        if not user:
            return lambda_response(401, {'error': 'Unauthorized'})
        
        table = dynamodb.Table(DDB_TABLE_NAME)
        response = table.scan()
        jobs = response.get('Items', [])
        
        return lambda_response(200, {'jobs': jobs})
        
    except Exception as e:
        print(f"Get jobs error: {str(e)}")
        return lambda_response(500, {'error': 'Internal server error'})

def delete_job_handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """Delete job"""
    try:
        # Verify auth
        auth_header = event.get('headers', {}).get('Authorization', '')
        user = verify_jwt(auth_header)
        if not user:
            return lambda_response(401, {'error': 'Unauthorized'})
        
        job_id = event.get('pathParameters', {}).get('proxy', '').split('/')[-1]
        if not job_id:
            return lambda_response(400, {'error': 'Job ID required'})
        
        table = dynamodb.Table(DDB_TABLE_NAME)
        table.delete_item(Key={'job_id': job_id})
        
        return lambda_response(200, {'message': 'Job deleted successfully'})
        
    except Exception as e:
        print(f"Delete job error: {str(e)}")
        return lambda_response(500, {'error': 'Internal server error'})

def restart_job_handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """Restart job"""
    try:
        # Verify auth
        auth_header = event.get('headers', {}).get('Authorization', '')
        user = verify_jwt(auth_header)
        if not user:
            return lambda_response(401, {'error': 'Unauthorized'})
        
        path_parts = event.get('pathParameters', {}).get('proxy', '').split('/')
        if len(path_parts) < 2:
            return lambda_response(400, {'error': 'Invalid path'})
        
        job_id = path_parts[1]  # jobs/{job_id}/restart
        
        # Update job status to pending
        table = dynamodb.Table(DDB_TABLE_NAME)
        table.update_item(
            Key={'job_id': job_id},
            UpdateExpression='SET #status = :status, updated_at = :updated_at',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'pending',
                ':updated_at': datetime.now(timezone.utc).isoformat()
            }
        )
        
        # Send to SQS
        if SQS_QUEUE_URL:
            sqs.send_message(
                QueueUrl=SQS_QUEUE_URL,
                MessageBody=json.dumps({'job_id': job_id}),
                MessageGroupId='video-processing'
            )
        
        return lambda_response(200, {'message': 'Job restarted successfully'})
        
    except Exception as e:
        print(f"Restart job error: {str(e)}")
        return lambda_response(500, {'error': 'Internal server error'})

def create_test_job_handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """Create test job"""
    try:
        # Verify auth
        auth_header = event.get('headers', {}).get('Authorization', '')
        user = verify_jwt(auth_header)
        if not user:
            return lambda_response(401, {'error': 'Unauthorized'})
        
        job_id = str(uuid.uuid4())
        
        # Create job in DynamoDB
        table = dynamodb.Table(DDB_TABLE_NAME)
        table.put_item(Item={
            'job_id': job_id,
            'video_key': 'test-video.mp4',
            'status': 'pending',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
        # Send to SQS
        if SQS_QUEUE_URL:
            sqs.send_message(
                QueueUrl=SQS_QUEUE_URL,
                MessageBody=json.dumps({'job_id': job_id}),
                MessageGroupId='video-processing'
            )
        
        return lambda_response(200, {'message': 'Test job created', 'job_id': job_id})
        
    except Exception as e:
        print(f"Create test job error: {str(e)}")
        return lambda_response(500, {'error': 'Internal server error'})

def health_handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """Health check"""
    return lambda_response(200, {'status': 'ok'})

def lambda_handler(event, context):
    """Main Lambda handler"""
    try:
        print(f"Event: {json.dumps(event, default=str)}")
        
        path = event.get('path', '')
        method = event.get('httpMethod', '')
        
        # Handle CORS preflight
        if method == 'OPTIONS':
            return lambda_response(200, {})
        
        # Route requests
        if path == '/prod/login' and method == 'POST':
            return login_handler(event)
        elif path == '/prod/jobs' and method == 'GET':
            return get_jobs_handler(event)
        elif path.startswith('/prod/jobs/') and path.endswith('/restart') and method == 'POST':
            return restart_job_handler(event)
        elif path.startswith('/prod/jobs/') and method == 'DELETE':
            return delete_job_handler(event)
        elif path == '/prod/jobs/test' and method == 'POST':
            return create_test_job_handler(event)
        elif path == '/prod/health' and method == 'GET':
            return health_handler(event)
        else:
            return lambda_response(404, {'error': 'Not found'})
            
    except Exception as e:
        print(f"Lambda handler error: {str(e)}")
        return lambda_response(500, {'error': 'Internal server error'})
