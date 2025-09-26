"""
Quick auth bypass for debugging
"""
from fastapi import Depends
from typing import Dict, Any

def get_current_user_bypass() -> Dict[str, Any]:
    """Bypass authentication for debugging"""
    return {
        "username": "admin@proovid.com",
        "email": "admin@proovid.com", 
        "role": "admin",
        "is_active": True,
        "sub": "debug-user"
    }

# Alias for easy replacement
get_current_user = get_current_user_bypass
require_admin = get_current_user_bypass
require_user = get_current_user_bypass
