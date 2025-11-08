#!/usr/bin/env python3
"""
Create DynamoDB tables for multi-tenant session management
"""
import boto3
import sys

def create_sessions_table():
    """Create sessions table with user_id GSI"""
    dynamodb = boto3.client('dynamodb', region_name='eu-central-1')
    
    try:
        response = dynamodb.create_table(
            TableName='proov_sessions',
            KeySchema=[
                {'AttributeName': 'session_id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'session_id', 'AttributeType': 'S'},
                {'AttributeName': 'user_id', 'AttributeType': 'S'},
                {'AttributeName': 'created_at', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'user_id-created_at-index',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'created_at', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        print("✅ Created proov_sessions table")
        print(f"   ARN: {response['TableDescription']['TableArn']}")
        return True
        
    except dynamodb.exceptions.ResourceInUseException:
        print("⚠️  Table proov_sessions already exists")
        return True
    except Exception as e:
        print(f"❌ Failed to create proov_sessions table: {e}")
        return False

def update_jobs_table_with_gsi():
    """Add user_id GSI to existing jobs table"""
    dynamodb = boto3.client('dynamodb', region_name='eu-central-1')
    
    try:
        response = dynamodb.update_table(
            TableName='proov_jobs',
            AttributeDefinitions=[
                {'AttributeName': 'user_id', 'AttributeType': 'S'},
                {'AttributeName': 'created_at', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexUpdates=[
                {
                    'Create': {
                        'IndexName': 'user_id-created_at-index',
                        'KeySchema': [
                            {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                            {'AttributeName': 'created_at', 'KeyType': 'RANGE'}
                        ],
                        'Projection': {'ProjectionType': 'ALL'},
                        'ProvisionedThroughput': {
                            'ReadCapacityUnits': 5,
                            'WriteCapacityUnits': 5
                        }
                    }
                }
            ]
        )
        
        print("✅ Added user_id-created_at-index to proov_jobs table")
        return True
        
    except dynamodb.exceptions.ResourceInUseException:
        print("⚠️  GSI already exists on proov_jobs table")
        return True
    except Exception as e:
        print(f"❌ Failed to update proov_jobs table: {e}")
        return False

def main():
    print("🚀 Creating multi-tenant session management tables...\n")
    
    success = True
    
    # Create sessions table
    if not create_sessions_table():
        success = False
    
    # Update jobs table with GSI
    if not update_jobs_table_with_gsi():
        success = False
    
    if success:
        print("\n✅ All tables configured successfully!")
        print("\nNext steps:")
        print("1. Update backend API to use session_manager.py")
        print("2. Update frontend to create sessions on upload")
        print("3. Filter jobs by user_id for isolation")
    else:
        print("\n❌ Some operations failed. Please check the errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()
