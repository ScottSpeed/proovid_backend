"""
Cognito JWT Authentication Module for Proov Backend
Provides enterprise-grade authentication with AWS Cognito integration
"""

import json
import base64
import logging
from typing import Optional, Dict, Any
import boto3
import jwt
import requests
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from botocore.config import Config

logger = logging.getLogger(__name__)

# Cognito Configuration
COGNITO_REGION = "eu-central-1"
COGNITO_USER_POOL_ID = "eu-central-1_ZpQH8Tpm4"
COGNITO_CLIENT_ID = "1ru136enta8u093mc04772q6a8"
COGNITO_ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
COGNITO_JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

# Security
security = HTTPBearer()

# AWS Configuration
boto3_config = Config(region_name=COGNITO_REGION)

# Cache for JWKs
_jwks_cache = None

def get_jwks():
    """Get JSON Web Key Set from Cognito with fallback"""
    global _jwks_cache
    if _jwks_cache is None:
        try:
            logger.info("Fetching JWKS from Cognito...")
            response = requests.get(COGNITO_JWKS_URL, timeout=5)
            response.raise_for_status()
            _jwks_cache = response.json()
            logger.info("JWKS cache loaded successfully")
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            logger.warning("Using hardcoded JWKS fallback for Cognito connectivity issue")
            # Hardcoded JWKS as emergency fallback for network connectivity issues
            _jwks_cache = {
                "keys": [
                    {
                        "alg": "RS256",
                        "e": "AQAB",
                        "kid": "xuf0hJ1M7rwjVdzKQtSlqCGaTbAu1YXEPM1jSJ0MrXw=",
                        "kty": "RSA",
                        "n": "yub3Oy_8KhglzAQO_bUOMS4NG7-uLp7OJDVoy6f-kH-9vCUo9KdtVeUnGfOXLwG2FGxUKNh-YPl4HOVTaZCt3L3sGhspNo5A6Qn1pWyKPIrTP8WEnxxFVFsODNgz8vVgDKGOk7-r8et8h6gNIS8Xmhq6wp6OBx8gN6RQNKyxKFkLDo6TnI2MqZIRlIwr6O8tSPD8OSF2C4rHh3KhmoG1oyIi_xirq0sy2YfH7fVGmzPp5tQ6J5NP-MaoA1KT2poBj8KrvxUpfmHEy7T3RQPzIG5_2rE6qcCJfPN9pFF5VBqP6H8U2WyGomTfmQaZp0aMo3nZ2fGcJkWMfnPbqw",
                        "use": "sig"
                    }
                ]
            }
    return _jwks_cache

def get_signing_key(token):
    """Get the signing key for a JWT token"""
    # Decode header without verification
    header = jwt.get_unverified_header(token)
    kid = header.get('kid')
    
    if not kid:
        raise ValueError("Token header missing 'kid'")
    
    # Get JWKs
    jwks = get_jwks()
    
    # Find the key
    for key in jwks.get('keys', []):
        if key.get('kid') == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
    
    raise ValueError(f"Unable to find a signing key that matches: '{kid}'")

def verify_cognito_token(token: str) -> Dict[str, Any]:
    """Verify and decode Cognito JWT token"""
    logger.info(f"JWT Verification attempt - Token length: {len(token)} chars")
    try:
        # Get the signing key
        signing_key = get_signing_key(token)
        
        # Decode and verify the token
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=COGNITO_CLIENT_ID,
            issuer=COGNITO_ISSUER
        )
        
        # Verify token_use claim
        if payload.get("token_use") != "id":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Expected ID token."
            )
        
        return payload
        
    except jwt.ExpiredSignatureError as e:
        logger.error(f"JWT Token expired: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT Token validation error: {e} | Token preview: {token[:50]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"JWT Unexpected token validation error: {e} | Token preview: {token[:50]}...")
        logger.error(f"JWT Config - Client ID: {COGNITO_CLIENT_ID} | Issuer: {COGNITO_ISSUER}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed"
        )

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current authenticated user from Cognito JWT token"""
    token = credentials.credentials
    payload = verify_cognito_token(token)
    
    # Extract user information from Cognito token
    user_info = {
        "username": payload.get("cognito:username"),
        "email": payload.get("email"),
        "sub": payload.get("sub"),
        "email_verified": payload.get("email_verified", False),
        "role": "admin",  # For now, all Cognito users are admin
        "is_active": True,
        "cognito_payload": payload
    }
    
    if not user_info["username"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload - missing username"
        )
    
    return user_info

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

# Optional: Keep backward compatibility for DynamoDB users
def get_dynamodb_resource():
    """Get DynamoDB resource with proper configuration"""
    return boto3.resource("dynamodb", region_name=COGNITO_REGION, config=boto3_config)

def get_user_from_dynamodb(username: str) -> Optional[Dict[str, Any]]:
    """Get user from DynamoDB (fallback for legacy users)"""
    try:
        ddb = get_dynamodb_resource()
        table = ddb.Table("proov_users")
        
        response = table.get_item(Key={"username": username})
        return response.get("Item")
    except Exception as e:
        logger.debug(f"Could not get user from DynamoDB: {e}")
        return None

# Pydantic Models
class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    new_password: str
    current_password: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserResponse(BaseModel):
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[str] = None
