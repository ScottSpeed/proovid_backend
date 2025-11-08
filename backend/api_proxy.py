"""
API Proxy - HTTPS to HTTP Bridge
Converts HTTPS requests from frontend to HTTP requests to backend ALB
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app, origins=["https://proovid.ai"])

# Backend ALB endpoint (HTTP)
BACKEND_URL = "http://ui-proov-alb-1535367426.eu-central-1.elb.amazonaws.com"

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze_proxy():
    """Proxy for /analyze endpoint"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Forward request to backend
        response = requests.post(
            f"{BACKEND_URL}/analyze",
            json=request.get_json(),
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/job-status', methods=['POST', 'OPTIONS'])
def job_status_proxy():
    """Proxy for /job-status endpoint"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Forward request to backend
        response = requests.post(
            f"{BACKEND_URL}/job-status",
            json=request.get_json(),
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat_proxy():
    """Proxy for /chat endpoint"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Forward request to backend
        response = requests.post(
            f"{BACKEND_URL}/chat",
            json=request.get_json(),
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "proxy_target": BACKEND_URL}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
