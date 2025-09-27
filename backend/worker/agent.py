from strands import Agent, tool
from strands_tools import calculator, current_time, python_repl
import boto3
import cv2
import numpy as np
import os
import tempfile
import json
import logging

@tool 
def rekognition_detect_labels(bucket: str = 'christian-aws-development', video: str = '210518_G26M_M2_45Sec_16x9_ENG_Webmix.mp4') -> str:
    """
    Erkennt Labels (Objekte, Personen, Aktivitäten, Szenen) in einem Video mit AWS Rekognition.
    Ermöglicht semantische Suchen wie 'Video mit Frau in rotem Kleid'.
    """
    import tempfile
    
    logging.info(f"rekognition_detect_labels started for s3://{bucket}/{video}")
    try:
        # Download video from S3
        s3 = boto3.client('s3')
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            logging.info(f"Downloading s3://{bucket}/{video} to {tmp.name}")
            s3.download_fileobj(bucket, video, tmp)
            temp_path = tmp.name
            logging.info(f"Download complete.")
        
        # Setup Rekognition client
        rekognition = boto3.client('rekognition')
        
        # Open video
        logging.info(f"Opening video file {temp_path} with cv2")
        cap = cv2.VideoCapture(temp_path)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        duration = frame_count / fps
        logging.info(f"Video has {frame_count} frames at {fps} FPS.")
        
        # Sample every 2-3 seconds for label detection
        sample_interval = int(fps * 2) if fps > 0 else 50
        if sample_interval < 1:
            sample_interval = 1
        
        frame_number = 0
        all_labels = []
        unique_labels = {}  # Track unique labels with confidence and timestamps
        
        while frame_number < frame_count:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = cap.read()
            if not ret:
                break
            
            try:
                logging.info(f"Processing frame {frame_number} for label detection.")
                # Convert frame to JPEG bytes
                _, buffer = cv2.imencode('.jpg', frame)
                image_bytes = buffer.tobytes()
                
                # Detect labels with Rekognition
                response = rekognition.detect_labels(
                    Image={'Bytes': image_bytes},
                    MaxLabels=50,  # Get more labels for better semantic search
                    MinConfidence=60.0
                )
                
                timestamp = frame_number / fps
                frame_labels = []
                
                for label in response['Labels']:
                    label_data = {
                        "name": label['Name'],
                        "confidence": label['Confidence'],
                        "timestamp": round(timestamp, 2),
                        "frame": frame_number,
                        "categories": [cat['Name'] for cat in label.get('Categories', [])],
                        "instances": []
                    }
                    
                    # Add bounding box info for instances (people, objects)
                    for instance in label.get('Instances', []):
                        if 'BoundingBox' in instance:
                            label_data["instances"].append({
                                "confidence": instance['Confidence'],
                                "bounding_box": instance['BoundingBox']
                            })
                    
                    frame_labels.append(label_data)
                    
                    # Track unique labels across video
                    label_key = label['Name'].lower()
                    if label_key not in unique_labels:
                        unique_labels[label_key] = {
                            "name": label['Name'],
                            "max_confidence": label['Confidence'],
                            "first_seen": timestamp,
                            "last_seen": timestamp,
                            "occurrences": 1,
                            "categories": [cat['Name'] for cat in label.get('Categories', [])]
                        }
                    else:
                        unique_labels[label_key]["max_confidence"] = max(
                            unique_labels[label_key]["max_confidence"], 
                            label['Confidence']
                        )
                        unique_labels[label_key]["last_seen"] = timestamp
                        unique_labels[label_key]["occurrences"] += 1
                
                all_labels.extend(frame_labels)
                
            except Exception as e:
                logging.warning(f"Label detection failed for frame {frame_number}: {e}")
            
            frame_number += sample_interval
        
        logging.info("Finished processing frames for label detection.")
        cap.release()
        os.unlink(temp_path)  # Clean up
        
        # Create semantic search friendly result
        result = {
            "total_labels_detected": len(all_labels),
            "unique_labels_count": len(unique_labels),
            "labels_by_frame": all_labels,
            "unique_labels": list(unique_labels.values()),
            "semantic_tags": [label["name"] for label in unique_labels.values()],
            "video_metadata": {
                "total_frames": frame_count,
                "fps": fps,
                "duration_seconds": round(duration, 2)
            },
            "categories_found": list(set([
                cat for label in unique_labels.values() 
                for cat in label.get("categories", [])
            ]))
        }
        
        logging.info(f"rekognition_detect_labels finished. Found {len(unique_labels)} unique labels.")
        return json.dumps(result, indent=2)
        
    except Exception as e:
        logging.error(f"Error in rekognition_detect_labels: {e}")
        return json.dumps({"total_labels_detected": 0, "unique_labels": [], "error": str(e)}, indent=2)

@tool
def rekognition_detect_text(bucket: str = 'christian-aws-development', video: str = '210518_G26M_M2_45Sec_16x9_ENG_Webmix.mp4') -> str:
    """
    Erkennt Text in einem Video, das sich in einem S3-Bucket befindet.
    Verwendet frame-by-frame Analyse ohne SNS/SQS.
    """
    import tempfile
    
    logging.info(f"rekognition_detect_text started for s3://{bucket}/{video}")
    try:
        # Download video from S3
        s3 = boto3.client('s3')
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            logging.info(f"Downloading s3://{bucket}/{video} to {tmp.name}")
            s3.download_fileobj(bucket, video, tmp)
            temp_path = tmp.name
            logging.info(f"Download complete.")
        
        # Setup Rekognition client
        # Setup Rekognition client
        rekognition = boto3.client('rekognition')
        
        # Open video
        logging.info(f"Opening video file {temp_path} with cv2")
        cap = cv2.VideoCapture(temp_path)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        duration = frame_count / fps
        logging.info(f"Video has {frame_count} frames at {fps} FPS.")
        
        # Sample roughly one frame per second
        sample_interval = int(fps) if fps > 0 else 1
        if sample_interval < 1:
            sample_interval = 1
        frame_number = 0
        text_detections = []
        
        while frame_number < frame_count:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = cap.read()
            if not ret:
                break
            
            try:
                logging.info(f"Processing frame {frame_number} for text detection.")
                # Convert frame to JPEG bytes
                _, buffer = cv2.imencode('.jpg', frame)
                image_bytes = buffer.tobytes()
                
                # Detect text with Rekognition
                response = rekognition.detect_text(Image={'Bytes': image_bytes})
                
                timestamp = frame_number / fps
                for text_detection in response['TextDetections']:
                    if text_detection['Type'] == 'LINE':  # Only capture full lines, not individual words
                        text_detections.append({
                            "text": text_detection['DetectedText'],
                            "confidence": text_detection['Confidence'],
                            "timestamp": round(timestamp, 2),
                            "frame": frame_number,
                            "bbox": text_detection['Geometry']['BoundingBox']
                        })
            except Exception as e:
                logging.warning(f"Text detection failed for frame {frame_number}: {e}")
            
            frame_number += sample_interval
        
        logging.info("Finished processing frames for text detection.")
        cap.release()
        os.unlink(temp_path)  # Clean up
        
        result = {
            "count": len(text_detections),
            "texts": text_detections,
            "video_metadata": {
                "total_frames": frame_count,
                "fps": fps,
                "duration_seconds": round(duration, 2)
            }
        }
        
        logging.info("rekognition_detect_text finished.")
        return json.dumps(result, indent=2)
        
    except Exception as e:
        logging.error(f"Error in rekognition_detect_text: {e}")
        return json.dumps({"count": 0, "texts": [], "error": str(e)}, indent=2)

@tool
def detect_blackframes(video_path: str = './Sample.mp4', bucket: str = None, s3_key: str = None) -> str:
    """
    Findet Blackframes im angegebenen Video (lokal oder aus S3) und gibt ein strukturiertes JSON-Ergebnis zurück.
    """
    logging.info(f"detect_blackframes started for s3://{bucket}/{s3_key}")
    # Falls S3-Parameter übergeben, lade das Video herunter
    if bucket and s3_key:
        import boto3
        s3 = boto3.client('s3')
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            logging.info(f"Downloading s3://{bucket}/{s3_key} to {tmp.name}")
            s3.download_fileobj(bucket, s3_key, tmp)
            tmp_path = tmp.name
        video_path = tmp_path
        logging.info(f"Download complete.")

    if not os.path.exists(video_path):
        logging.error(f"Video '{video_path}' nicht gefunden.")
        return f"Video '{video_path}' nicht gefunden."
    
    detected_blackframes = []
    logging.info(f"Opening video file {video_path} with cv2")
    cap = cv2.VideoCapture(video_path)
    frame_number = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 25  # fallback to 25 fps
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    logging.info(f"Video has {total_frames} frames at {fps} FPS.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = np.mean(gray)
        timestamp = frame_number / fps
        
        if mean_brightness < 20:
            detected_blackframes.append({
                "frame": frame_number, 
                "brightness": float(mean_brightness),
                "timestamp": float(timestamp)
            })
        if frame_number % 100 == 0:
            logging.info(f"Processed frame {frame_number}/{total_frames}")
        frame_number += 1
    
    logging.info("Finished processing frames.")
    cap.release()
    if bucket and s3_key:
        os.remove(video_path)  # temporäre Datei aufräumen
    
    # Strukturiertes JSON-Ergebnis
    result = {
        "count": len(detected_blackframes),
        "total_frames": total_frames,
        "frames": detected_blackframes,
        "percentage": (len(detected_blackframes) / total_frames * 100) if total_frames > 0 else 0
    }
    
    logging.info("detect_blackframes finished.")
    return json.dumps(result, indent=2)

@tool 
def analyze_video_complete(bucket: str = 'christian-aws-development', video: str = '210518_G26M_M2_45Sec_16x9_ENG_Webmix.mp4') -> str:
    """
    Führt eine vollständige Videoanalyse durch: Blackframe-Erkennung, Texterkennung UND Label-Erkennung.
    """
    logging.info(f"Starting complete video analysis for {bucket}/{video}")
    
    # 1. Blackframe-Erkennung
    logging.info("Starting blackframe detection.")
    blackframes_result = detect_blackframes(video_path="", bucket=bucket, s3_key=video)
    logging.info("Finished blackframe detection.")
    blackframes_data = json.loads(blackframes_result)
    
    # 2. Texterkennung
    logging.info("Starting text detection.")
    text_result = rekognition_detect_text(bucket=bucket, video=video)
    logging.info("Finished text detection.")
    text_data = json.loads(text_result)
    
    # 3. Label-Erkennung (NEU!)
    logging.info("Starting label detection.")
    labels_result = rekognition_detect_labels(bucket=bucket, video=video)
    logging.info("Finished label detection.")
    labels_data = json.loads(labels_result)
    
    # 4. Kombiniere alle Ergebnisse
    complete_result = {
        "analysis_type": "complete",
        "video_info": {
            "bucket": bucket,
            "key": video
        },
        "blackframes": {
            "blackframes_detected": blackframes_data.get("count", 0),
            "black_frames": blackframes_data.get("frames", []),
            "video_metadata": {
                "total_frames": blackframes_data.get("total_frames", 0),
                "percentage_black": blackframes_data.get("percentage", 0)
            }
        },
        "text_detection": {
            "text_detections": text_data.get("texts", []),
            "count": text_data.get("count", 0)
        },
        "label_detection": {
            "total_labels": labels_data.get("total_labels_detected", 0),
            "unique_labels": labels_data.get("unique_labels", []),
            "semantic_tags": labels_data.get("semantic_tags", []),
            "categories": labels_data.get("categories_found", [])
        },
        "summary": {
            "blackframes_count": blackframes_data.get("count", 0),
            "text_detections_count": text_data.get("count", 0),
            "labels_count": labels_data.get("unique_labels_count", 0),
            "semantic_tags": labels_data.get("semantic_tags", []),
            "has_issues": blackframes_data.get("count", 0) > 0,
            "has_content": text_data.get("count", 0) > 0 or labels_data.get("unique_labels_count", 0) > 0
        }
    }
    
    logging.info("analyze_video_complete finished.")
    return json.dumps(complete_result, indent=2)

agent = Agent(
    tools=[rekognition_detect_text, rekognition_detect_labels, detect_blackframes, analyze_video_complete],
    model="eu.anthropic.claude-3-5-sonnet-20240620-v1:0"
)

if __name__ == "__main__":
    message = """
    I have 3 requests:

    1. Can you find black frames in the video './backend/BlackframeVideo.mp4'?
    2. What text can you detect in the video '210518_G26M_M2_45Sec_16x9_ENG_Webmix.mp4'?
    3. Can you find this text in the video: "8,3 km; CO2 emissions combined: 189 g/km; CO2-class(es): G"
    """
    print(agent(message))