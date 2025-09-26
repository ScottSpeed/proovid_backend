import json
import boto3

def lambda_handler(event, context):
    """
    Lambda function to scale worker service on-demand when jobs are queued.
    Triggered by SQS queue events.
    """
    
    ecs = boto3.client('ecs')
    sqs = boto3.client('sqs')
    
    cluster_name = 'my-cluster'
    service_name = 'worker-service'
    queue_url = 'https://sqs.eu-central-1.amazonaws.com/851725596604/proov-worker-queue'
    
    try:
        # Check queue length
        queue_attrs = sqs.get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['ApproximateNumberOfMessages']
        )
        
        message_count = int(queue_attrs['Attributes']['ApproximateNumberOfMessages'])
        
        # Scale based on queue length
        if message_count > 0:
            # Scale up to handle jobs (max 2 instances for cost control)
            desired_count = min(2, message_count)
            
            response = ecs.update_service(
                cluster=cluster_name,
                service=service_name,
                desiredCount=desired_count
            )
            
            print(f"Scaled worker service to {desired_count} instances")
            
        else:
            # Scale down to 0 when no jobs
            response = ecs.update_service(
                cluster=cluster_name,
                service=service_name,
                desiredCount=0
            )
            
            print("Scaled worker service to 0 instances")
            
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Worker service scaled successfully',
                'messageCount': message_count,
                'desiredCount': desired_count if message_count > 0 else 0
            })
        }
        
    except Exception as e:
        print(f"Error scaling worker service: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }