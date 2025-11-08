"""
User Session Management for Video Analysis
Provides multi-tenant isolation with session-based job grouping
"""
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import boto3
from boto3.dynamodb.conditions import Key, Attr
import logging

logger = logging.getLogger(__name__)

def get_sessions_table():
    """Get DynamoDB sessions table"""
    dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
    return dynamodb.Table('proov_sessions')

def get_jobs_table():
    """Get DynamoDB jobs table"""
    dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
    return dynamodb.Table('proov_jobs')

def create_session(user_id: str, user_email: str) -> str:
    """
    Create a new upload session for a user
    Returns: session_id
    """
    session_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    
    sessions_table = get_sessions_table()
    sessions_table.put_item(
        Item={
            'session_id': session_id,
            'user_id': user_id,
            'user_email': user_email,
            'created_at': timestamp,
            'status': 'active',
            'job_ids': [],
            'total_jobs': 0,
            'completed_jobs': 0
        }
    )
    
    logger.info(f"Created session {session_id} for user {user_email}")
    return session_id

def add_job_to_session(session_id: str, job_id: str):
    """Add a job to a session"""
    sessions_table = get_sessions_table()
    
    # Get current session
    response = sessions_table.get_item(Key={'session_id': session_id})
    session = response.get('Item')
    
    if not session:
        logger.error(f"Session {session_id} not found")
        return
    
    # Update job list
    job_ids = session.get('job_ids', [])
    job_ids.append(job_id)
    
    sessions_table.update_item(
        Key={'session_id': session_id},
        UpdateExpression='SET job_ids = :jobs, total_jobs = :total',
        ExpressionAttributeValues={
            ':jobs': job_ids,
            ':total': len(job_ids)
        }
    )
    
    logger.info(f"Added job {job_id} to session {session_id}")

def save_job_with_user(
    job_id: str,
    status: str,
    user_id: str,
    user_email: str,
    session_id: str,
    video: Dict[str, Any]
):
    """Save job with user and session information"""
    jobs_table = get_jobs_table()
    timestamp = datetime.now(timezone.utc).isoformat()
    
    jobs_table.put_item(
        Item={
            'job_id': job_id,
            'status': status,
            'user_id': user_id,
            'user_email': user_email,
            'session_id': session_id,
            'created_at': timestamp,
            'updated_at': timestamp,
            'video_data': video,
            'result': ''
        }
    )
    
    logger.info(f"Created job {job_id} for user {user_email} in session {session_id}")

def get_user_sessions(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Get all sessions for a user"""
    sessions_table = get_sessions_table()
    
    response = sessions_table.query(
        IndexName='user_id-created_at-index',  # GSI needed
        KeyConditionExpression=Key('user_id').eq(user_id),
        ScanIndexForward=False,  # Sort descending (newest first)
        Limit=limit
    )
    
    return response.get('Items', [])

def get_session_jobs(session_id: str, user_id: str) -> List[Dict[str, Any]]:
    """Get all jobs for a specific session (with user verification)"""
    # First verify the session belongs to the user
    sessions_table = get_sessions_table()
    session_response = sessions_table.get_item(Key={'session_id': session_id})
    session = session_response.get('Item')
    
    if not session or session.get('user_id') != user_id:
        logger.warning(f"Unauthorized access attempt: user {user_id} to session {session_id}")
        return []
    
    # Get all jobs for this session
    jobs_table = get_jobs_table()
    job_ids = session.get('job_ids', [])
    
    jobs = []
    for job_id in job_ids:
        response = jobs_table.get_item(Key={'job_id': job_id})
        item = response.get('Item')
        if item:
            jobs.append(item)
    
    return jobs

def get_user_jobs(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get all jobs for a user across all sessions"""
    jobs_table = get_jobs_table()
    
    response = jobs_table.query(
        IndexName='user_id-created_at-index',  # GSI needed
        KeyConditionExpression=Key('user_id').eq(user_id),
        ScanIndexForward=False,  # Sort descending (newest first)
        Limit=limit
    )
    
    return response.get('Items', [])

def update_session_progress(session_id: str):
    """Update session progress based on job statuses"""
    sessions_table = get_sessions_table()
    jobs_table = get_jobs_table()
    
    # Get session
    response = sessions_table.get_item(Key={'session_id': session_id})
    session = response.get('Item')
    
    if not session:
        return
    
    # Count completed jobs
    job_ids = session.get('job_ids', [])
    completed = 0
    failed = 0
    
    for job_id in job_ids:
        job_response = jobs_table.get_item(Key={'job_id': job_id})
        job = job_response.get('Item')
        if job:
            status = job.get('status', '')
            if status == 'completed':
                completed += 1
            elif status == 'failed':
                failed += 1
    
    # Determine session status
    total = len(job_ids)
    if completed + failed == total:
        session_status = 'completed'
    elif failed > 0:
        session_status = 'processing_with_errors'
    else:
        session_status = 'processing'
    
    # Update session
    sessions_table.update_item(
        Key={'session_id': session_id},
        UpdateExpression='SET completed_jobs = :completed, failed_jobs = :failed, #s = :status',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':completed': completed,
            ':failed': failed,
            ':status': session_status
        }
    )
    
    logger.info(f"Updated session {session_id}: {completed}/{total} completed, {failed} failed")
