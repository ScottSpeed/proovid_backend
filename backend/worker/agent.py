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
    Führt eine vollständige Videoanalyse durch: Blackframe-Erkennung UND Texterkennung.
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
    
    # 3. Kombiniere Ergebnisse
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
        "summary": {
            "blackframes_count": blackframes_data.get("count", 0),
            "text_detections_count": text_data.get("count", 0),
            "has_issues": blackframes_data.get("count", 0) > 0 or text_data.get("count", 0) > 0
        }
    }
    
    logging.info("analyze_video_complete finished.")
    return json.dumps(complete_result, indent=2)

agent = Agent(
    tools=[rekognition_detect_text, detect_blackframes, analyze_video_complete],
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