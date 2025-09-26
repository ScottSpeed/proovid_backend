#!/usr/bin/env python3

import requests
import json

# Test the API
base_url = "http://localhost:8000"

# First login to get a token
login_data = {
    "username": "admin",  # Change this to your actual username
    "password": "admin123"  # Change this to your actual password
}

print("Attempting to login...")
try:
    login_response = requests.post(f"{base_url}/auth/login", json=login_data)
    print(f"Login status: {login_response.status_code}")
    
    if login_response.status_code == 200:
        login_result = login_response.json()
        token = login_result.get("access_token")
        print(f"Login successful! Token: {token[:20]}...")
        
        # Now test the jobs endpoint
        headers = {"Authorization": f"Bearer {token}"}
        jobs_response = requests.get(f"{base_url}/jobs", headers=headers)
        print(f"Jobs status: {jobs_response.status_code}")
        
        if jobs_response.status_code == 200:
            jobs_data = jobs_response.json()
            print(f"Number of jobs: {len(jobs_data)}")
            
            # Print first few jobs
            for i, job in enumerate(jobs_data[:3]):
                print(f"\nJob {i+1}:")
                print(f"  ID: {job.get('job_id', 'N/A')}")
                print(f"  Status: {job.get('status', 'N/A')}")
                print(f"  Video: {job.get('video', 'N/A')}")
                print(f"  S3 Key: {job.get('s3_key', 'N/A')}")
                print(f"  Latest Doc Video: {job.get('latest_doc', {}).get('video', 'N/A')}")
                print(f"  Latest Doc S3 Key: {job.get('latest_doc', {}).get('s3_key', 'N/A')}")
        else:
            print(f"Failed to get jobs: {jobs_response.text}")
    else:
        print(f"Login failed: {login_response.text}")
        
except requests.exceptions.ConnectionError:
    print("Could not connect to the API. Make sure the backend is running on port 8000.")
except Exception as e:
    print(f"Error: {e}")
