"""
JWT Authentication Module for Proov Backend
Provides enterprise-grade authentication with user management
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
import bcrypt
import boto3
import os
import logging
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from botocore.config import Config

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# AWS Configuration
boto3_config = Config(region_name=os.environ.get("AWS_DEFAULT_REGION", "eu-central-1"))

def get_dynamodb_resource():
    """Get DynamoDB resource with proper configuration"""
    region = os.environ.get("AWS_DEFAULT_REGION", "eu-central-1")
    return boto3.resource("dynamodb", region_name=region, config=boto3_config)

def ensure_users_table():
    """Create users table if it doesn't exist"""
    ddb = get_dynamodb_resource()
    table_name = "proov_users"
    
    try:
        table = ddb.Table(table_name)
        table.load()
        logger.info("DynamoDB users table '%s' exists", table_name)
        return table
    except Exception as e:
        logger.info("Creating DynamoDB users table %s", table_name)
        table = ddb.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "username", "KeyType": "HASH"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "username", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        table.wait_until_exists()
        logger.info("Created users table successfully")
        
        # Create default admin user
        create_default_admin_user(table)
        return table

def create_default_admin_user(table):
    """Create default admin user"""
    admin_user = {
        "username": "admin",
        "email": "admin@proovid.de", 
        "password_hash": hash_password("proov2025"),
        "role": "admin",
        "created_at": datetime.utcnow().isoformat(),
        "is_active": True
    }
    
    try:
        table.put_item(Item=admin_user, ConditionExpression="attribute_not_exists(username)")
        logger.info("Created default admin user: admin/proov2025")
    except Exception as e:
        logger.info("Admin user already exists")

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def update_user_password(username: str, new_password: str) -> bool:
    """Update user password in DynamoDB"""
    try:
        table = ensure_users_table()
        hashed_password = hash_password(new_password)
        
        table.update_item(
            Key={"username": username},
            UpdateExpression="SET password_hash = :password",
            ExpressionAttributeValues={":password": hashed_password}
        )
        
        logger.info(f"Password updated for user: {username}")
        return True
    except Exception as e:
        logger.error(f"Failed to update password for {username}: {e}")
        return False

def create_access_token(data: Dict[str, Any]) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Dict[str, Any]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user from database"""
    table = ensure_users_table()
    
    try:
        response = table.get_item(Key={"username": username})
        return response.get("Item")
    except Exception as e:
        logger.error(f"Error getting user {username}: {e}")
        return None

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate user credentials"""
    user = get_user_by_username(username)
    if not user:
        return None
    
    if not user.get("is_active", False):
        return None
        
    if not verify_password(password, user["password_hash"]):
        return None
        
    return user

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = verify_token(token)
    
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
        
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account disabled"
        )
    
    return user

def require_role(required_role: str):
    """Decorator to require specific role"""
    def role_dependency(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_role = current_user.get("role", "user")
        
        # Admin can access everything
        if user_role == "admin":
            return current_user
            
        # Check specific role
        if user_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}"
            )
        
        return current_user
    
    return role_dependency

# Role-based dependencies
require_admin = require_role("admin")
require_user = require_role("user")

# Pydantic Models
class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    new_password: str
    current_password: Optional[str] = None  # Optional for admin override

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserResponse(BaseModel):
    username: str
    email: str
    role: str
    is_active: bool
    created_at: str
