#!/usr/bin/env python3

import json
import copy

# Load current configuration
with open('current-cloudfront-config-new.json', 'r') as f:
    config = json.load(f)

distribution_config = config['DistributionConfig']

# Fix 1: Update ALB origin protocol policy
for origin in distribution_config['Origins']['Items']:
    if origin['Id'] == 'alb-backend-origin':
        origin['CustomOriginConfig']['OriginProtocolPolicy'] = 'http-only'
        print(f"Fixed origin protocol policy for {origin['Id']} to http-only")
        break

# Fix 2: Add /api/* cache behaviors
template_behavior = None
for behavior in distribution_config['CacheBehaviors']['Items']:
    if behavior['PathPattern'] == '/jobs*':
        template_behavior = behavior
        break

if template_behavior:
    api_patterns = ['/api/jobs*', '/api/list-videos*', '/api/analyze*', '/api/health*', '/api/ask*', '/api/job-status*']
    
    new_behaviors = []
    for pattern in api_patterns:
        new_behavior = copy.deepcopy(template_behavior)
        new_behavior['PathPattern'] = pattern
        new_behaviors.append(new_behavior)
    
    # Add the new behaviors to the existing ones
    distribution_config['CacheBehaviors']['Items'].extend(new_behaviors)
    distribution_config['CacheBehaviors']['Quantity'] += len(new_behaviors)
    
    print(f"Added {len(new_behaviors)} new cache behaviors for API routes")
else:
    print("ERROR: Could not find template behavior for /jobs*")

# Save updated config
with open('updated-cloudfront-config-final.json', 'w') as f:
    json.dump(distribution_config, f, indent=2)

print("Final configuration saved to updated-cloudfront-config-final.json")