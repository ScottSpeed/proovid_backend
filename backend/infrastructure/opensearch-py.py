# Ausführen in exakt demselben Environment wie dein Worker
import os, boto3, sys
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

print("caller:", boto3.client("sts").get_caller_identity())  # Identity check

host = os.getenv("OPENSEARCH_HOST")
region = os.getenv("AWS_DEFAULT_REGION","eu-central-1")
creds = boto3.Session().get_credentials()
awsauth = AWS4Auth(creds.access_key, creds.secret_key, region, "aoss", session_token=creds.token)

client = OpenSearch(hosts=[{"host":host,"port":443}], http_auth=awsauth,
                    use_ssl=True, verify_certs=True, connection_class=RequestsHttpConnection)

print("Trying index...")
print(client.index(index="video-vector-collection", id="dbg-1", body={"x":1}))