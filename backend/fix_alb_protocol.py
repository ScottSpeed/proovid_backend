#!/usr/bin/env python3

import json

# Load current configuration
with open('current-cloudfront-config.json', 'r') as f:
    config = json.load(f)

# Find and update the ALB origin
distribution_config = config['DistributionConfig']

for origin in distribution_config['Origins']['Items']:
    if origin['Id'] == 'alb-backend-origin':
        # Change from https-only to http-only since ALB doesn't support HTTPS
        origin['CustomOriginConfig']['OriginProtocolPolicy'] = 'http-only'
        print(f"Changed origin protocol policy for {origin['Id']} to http-only")
        break

# Save updated config
with open('updated-cloudfront-config-v2.json', 'w') as f:
    json.dump(distribution_config, f, indent=2)

print("Updated configuration saved to updated-cloudfront-config-v2.json")