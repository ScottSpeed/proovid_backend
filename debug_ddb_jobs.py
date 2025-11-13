import boto3, os, json, sys

def get_table():
    region = os.environ.get("AWS_DEFAULT_REGION", "eu-central-1")
    ddb = boto3.resource("dynamodb", region_name=region)
    return ddb.Table(os.environ.get("JOB_TABLE", "proov_jobs"))


def fetch_job(job_id: str):
    t = get_table()
    resp = t.get_item(Key={"job_id": job_id}, ConsistentRead=True)
    return resp.get("Item")


def fetch_session(session_id: str):
    t = get_table()
    fe = "session_id = :sid"
    resp = t.scan(FilterExpression=fe, ExpressionAttributeValues={":sid": session_id})
    return resp.get("Items", [])

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("Usage: python debug_ddb_jobs.py <job_id>|session:<session_id> [more...]")
        sys.exit(1)
    for arg in args:
        if arg.startswith("session:"):
            sid = arg.split(":",1)[1]
            items = fetch_session(sid)
            print(f"\nSession {sid}: {len(items)} items")
            for it in items:
                print(json.dumps({
                    'job_id': it.get('job_id'),
                    'status': it.get('status'),
                    'user_id': it.get('user_id'),
                    'session_id': it.get('session_id'),
                    's3_key': it.get('s3_key'),
                    'sqs_message_id': it.get('sqs_message_id'),
                    'enqueued_at': it.get('enqueued_at'),
                    'enqueue_attempts': it.get('enqueue_attempts'),
                    'enqueue_last_error': it.get('enqueue_last_error'),
                }, ensure_ascii=False, default=str))
        else:
            item = fetch_job(arg)
            print(f"\nJob {arg}:\n{json.dumps(item, ensure_ascii=False, default=str)}")
