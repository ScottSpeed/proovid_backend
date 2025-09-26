#!/usr/bin/env python3

import json
import copy

# Load current configuration
with open('current-cloudfront-config.json', 'r') as f:
    config = json.load(f)

# Get the existing cache behavior for /jobs* as a template
template_behavior = None
for behavior in config['DistributionConfig']['CacheBehaviors']['Items']:
    if behavior['PathPattern'] == '/jobs*':
        template_behavior = behavior
        break

if not template_behavior:
    print("Error: No /jobs* behavior found as template")
    exit(1)

# Create new cache behaviors for /api/* patterns
api_patterns = ['/api/jobs*', '/api/list-videos*', '/api/analyze*', '/api/health*', '/api/ask*', '/api/job-status*']

new_behaviors = []
for pattern in api_patterns:
    new_behavior = copy.deepcopy(template_behavior)
    new_behavior['PathPattern'] = pattern
    new_behaviors.append(new_behavior)

# Add the new behaviors to the existing ones
config['DistributionConfig']['CacheBehaviors']['Items'].extend(new_behaviors)
config['DistributionConfig']['CacheBehaviors']['Quantity'] += len(new_behaviors)

# Remove the ETag for update
distribution_config = config['DistributionConfig']

# Save updated config
with open('updated-cloudfront-config.json', 'w') as f:
    json.dump(distribution_config, f, indent=2)

print(f"Added {len(new_behaviors)} new cache behaviors for API routes")
print("Updated configuration saved to updated-cloudfront-config.json")