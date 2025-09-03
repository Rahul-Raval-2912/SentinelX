import os
import json
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any
import torch
import cv2
import numpy as np
from PIL import Image
import face_recognition
import whisper
import spacy
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
import redis.asyncio as redis
import boto3
from cryptography.fernet import Fernet
import psutil
import subprocess
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GPU Redaction Worker", version="1.0.0")

# Metrics
PROCESSED_REPORTS = Counter('processed_reports_total', 'Total processed reports')
PROCESSING_TIME = Histogram('processing_time_seconds', 'Time spent processing reports')
GPU_UTILIZATION = Gauge('gpu_utilization_percent', 'GPU utilization percentage')
FACES_REDACTED = Counter('faces_redacted_total', 'Total faces redacted')
PII_REDACTED = Counter('pii_entities_redacted_total', 'Total PII entities redacted')

class GPURedactionWorker:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {self.device}")
        
        # Load models
        self.load_models()
        
        # Initialize clients
        self.redis_client = None
        self.s3_client = boto3.client('s3')
        
    def load_models(self):
        """Load all ML models for redaction"""
        logger.info("Loading ML models...")
        
        # OCR Model (TrOCR)
        self.ocr_processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-printed')
        self.ocr_model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-printed')
        self.ocr_model.to(self.device)
        
        # Whisper for audio transcription
        self.whisper_model = whisper.load_model("base")
        
        # SpaCy for NER
        self.nlp = spacy.load("en_core_web_sm")
        
        logger.info("Models loaded successfully")
    
    async def connect_redis(self):
        """Connect to Redis queue"""
        self.redis_client = redis.from_url(
            os.getenv('REDIS_URL', 'redis://localhost:6379')
        )
    
    def detect_and_redact_faces(self, image_array: np.ndarray) -> tuple:
        """Detect and redact faces in image"""
        face_locations = face_recognition.face_locations(image_array)
        
        redacted_image = image_array.copy()
        for (top, right, bottom, left) in face_locations:
            # Apply Gaussian blur to face region
            face_region = redacted_image[top:bottom, left:right]
            blurred_face = cv2.GaussianBlur(face_region, (99, 99), 30)
            redacted_image[top:bottom, left:right] = blurred_face
        
        FACES_REDACTED.inc(len(face_locations))
        return redacted_image, len(face_locations)
    
    def extract_and_redact_text(self, image: Image.Image) -> tuple:
        """Extract text using OCR and redact PII"""
        # OCR extraction
        pixel_values = self.ocr_processor(image, return_tensors="pt").pixel_values.to(self.device)
        generated_ids = self.ocr_model.generate(pixel_values)
        generated_text = self.ocr_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        # NER for PII detection
        doc = self.nlp(generated_text)
        pii_entities = []
        
        for ent in doc.ents:
            if ent.label_ in ['PERSON', 'ORG', 'GPE', 'PHONE', 'EMAIL', 'SSN', 'CREDIT_CARD']:
                pii_entities.append({
                    'text': ent.text,
                    'label': ent.label_,
                    'start': ent.start_char,
                    'end': ent.end_char
                })
        
        # Redact PII from text
        redacted_text = generated_text
        for entity in sorted(pii_entities, key=lambda x: x['start'], reverse=True):
            redacted_text = redacted_text[:entity['start']] + '[REDACTED]' + redacted_text[entity['end']:]
        
        PII_REDACTED.inc(len(pii_entities))
        return redacted_text, len(pii_entities)
    
    def process_audio(self, audio_path: str) -> dict:
        """Process audio file with Whisper and redact PII"""
        result = self.whisper_model.transcribe(audio_path)
        transcript = result["text"]
        
        # Apply NER to transcript
        doc = self.nlp(transcript)
        pii_count = 0
        redacted_transcript = transcript
        
        for ent in reversed(doc.ents):
            if ent.label_ in ['PERSON', 'ORG', 'GPE', 'PHONE', 'EMAIL']:
                redacted_transcript = redacted_transcript[:ent.start_char] + '[REDACTED]' + redacted_transcript[ent.end_char:]
                pii_count += 1
        
        PII_REDACTED.inc(pii_count)
        return {
            'original_transcript': transcript,
            'redacted_transcript': redacted_transcript,
            'pii_entities_found': pii_count
        }
    
    async def process_report(self, job_data: dict) -> dict:
        """Main processing function for a report"""
        report_id = job_data['reportId']
        logger.info(f"Processing report {report_id}")
        
        with PROCESSING_TIME.time():
            try:
                results = {
                    'reportId': report_id,
                    'status': 'processing',
                    'redactionSummary': {
                        'facesRedacted': 0,
                        'piiRedacted': 0,
                        'filesProcessed': 0
                    },
                    'processedFiles': []
                }
                
                # Process each file
                for file_info in job_data.get('files', []):
                    file_result = await self.process_file(file_info, job_data['wrappedKey'])
                    results['processedFiles'].append(file_result)
                    results['redactionSummary']['facesRedacted'] += file_result.get('facesRedacted', 0)
                    results['redactionSummary']['piiRedacted'] += file_result.get('piiRedacted', 0)
                    results['redactionSummary']['filesProcessed'] += 1
                
                results['status'] = 'completed'
                PROCESSED_REPORTS.inc()
                
                return results
                
            except Exception as e:
                logger.error(f"Processing failed for report {report_id}: {str(e)}")
                return {
                    'reportId': report_id,
                    'status': 'failed',
                    'error': str(e)
                }
    
    async def process_file(self, file_info: dict, encryption_key: str) -> dict:
        """Process individual file"""
        file_key = file_info['key']
        original_name = file_info['originalName']
        
        # Download encrypted file from S3
        response = self.s3_client.get_object(
            Bucket=os.getenv('S3_BUCKET', 'incident-reports-encrypted'),
            Key=file_key
        )
        encrypted_content = response['Body'].read()
        
        # Decrypt file (simplified - use proper decryption in production)
        # decrypted_content = decrypt_file_content(encrypted_content, encryption_key)
        
        file_extension = original_name.lower().split('.')[-1]
        result = {
            'originalName': original_name,
            'fileKey': file_key,
            'facesRedacted': 0,
            'piiRedacted': 0,
            'processed': True
        }
        
        try:
            if file_extension in ['jpg', 'jpeg', 'png', 'gif']:
                # Process image
                image_array = np.frombuffer(encrypted_content, np.uint8)
                image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                
                # Face redaction
                redacted_image, faces_count = self.detect_and_redact_faces(image)
                result['facesRedacted'] = faces_count
                
                # OCR and PII redaction
                pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                _, pii_count = self.extract_and_redact_text(pil_image)
                result['piiRedacted'] = pii_count
                
                # Save redacted image back to S3
                redacted_key = f"redacted/{file_key}"
                _, buffer = cv2.imencode('.jpg', redacted_image)
                self.s3_client.put_object(
                    Bucket=os.getenv('S3_BUCKET', 'incident-reports-encrypted'),
                    Key=redacted_key,
                    Body=buffer.tobytes(),
                    ServerSideEncryption='AES256'
                )
                result['redactedKey'] = redacted_key
                
            elif file_extension in ['mp3', 'wav', 'mp4']:
                # Process audio/video
                temp_file = f"/tmp/{original_name}"
                with open(temp_file, 'wb') as f:
                    f.write(encrypted_content)
                
                audio_result = self.process_audio(temp_file)
                result['piiRedacted'] = audio_result['pii_entities_found']
                result['transcript'] = audio_result['redacted_transcript']
                
                os.remove(temp_file)
                
        except Exception as e:
            logger.error(f"File processing error for {original_name}: {str(e)}")
            result['processed'] = False
            result['error'] = str(e)
        
        return result

# Initialize worker
worker = GPURedactionWorker()

@app.on_event("startup")
async def startup_event():
    await worker.connect_redis()
    # Start background job processor
    asyncio.create_task(job_processor())

async def job_processor():
    """Background task to process jobs from Redis queue"""
    while True:
        try:
            # Pop job from queue
            job_data = await worker.redis_client.brpop('gpu-worker-queue', timeout=10)
            
            if job_data:
                job_json = json.loads(job_data[1])
                result = await worker.process_report(job_json)
                
                # Send result back to gateway API
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    webhook_url = os.getenv('GATEWAY_WEBHOOK_URL', 'http://localhost:8000/api/webhook/processing-complete')
                    await session.post(webhook_url, json=result)
                
        except Exception as e:
            logger.error(f"Job processor error: {str(e)}")
            await asyncio.sleep(5)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            'gpu_available': True,
            'gpu_count': torch.cuda.device_count(),
            'gpu_name': torch.cuda.get_device_name(0),
            'gpu_memory_allocated': torch.cuda.memory_allocated(0),
            'gpu_memory_cached': torch.cuda.memory_reserved(0)
        }
        
        # Update GPU utilization metric
        try:
            nvidia_smi = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'], 
                                      capture_output=True, text=True)
            if nvidia_smi.returncode == 0:
                gpu_util = float(nvidia_smi.stdout.strip())
                GPU_UTILIZATION.set(gpu_util)
                gpu_info['gpu_utilization'] = gpu_util
        except:
            pass
    
    return {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'device': str(worker.device),
        'cpu_percent': psutil.cpu_percent(),
        'memory_percent': psutil.virtual_memory().percent,
        **gpu_info
    }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.post("/process")
async def process_report_endpoint(job_data: dict, background_tasks: BackgroundTasks):
    """Manual processing endpoint for testing"""
    background_tasks.add_task(worker.process_report, job_data)
    return {"message": "Processing started", "reportId": job_data.get('reportId')}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)