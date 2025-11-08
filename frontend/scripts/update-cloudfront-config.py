import json
import subprocess

# Get CloudFront config directly using AWS CLI
result = subprocess.run(
    ['aws', 'cloudfront', 'get-distribution-config', '--id', 'EQ43E3L88MMF9'],
    capture_output=True,
    text=True
)

if result.returncode != 0:
    print(f"Error getting CloudFront config: {result.stderr}")
    exit(1)

data = json.loads(result.stdout)

# Extract ETag and DistributionConfig
etag = data['ETag']
config = data['DistributionConfig']

# Add custom error response for SPA routing
config['CustomErrorResponses'] = {
    "Quantity": 1,
    "Items": [
        {
            "ErrorCode": 404,
            "ResponsePagePath": "/index.html",
            "ResponseCode": "200",
            "ErrorCachingMinTTL": 300
        }
    ]
}

# Save updated config (without ETag)
with open('c:/Users/chris/proovid_backend/frontend/scripts/cloudfront-config-updated.json', 'w') as f:
    json.dump(config, f, indent=2)

# Save ETag separately
with open('c:/Users/chris/proovid_backend/frontend/scripts/cloudfront-etag.txt', 'w') as f:
    f.write(etag)

print(f"Config updated. ETag: {etag}")
print("Now run:")
print(f'aws cloudfront update-distribution --id EQ43E3L88MMF9 --distribution-config file://c:/Users/chris/proovid_backend/frontend/scripts/cloudfront-config-updated.json --if-match {etag}')
