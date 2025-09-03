import pytest
import asyncio
import json
from unittest.mock import Mock, patch
from main import GPURedactionWorker
import numpy as np
from PIL import Image

@pytest.fixture
def worker():
    return GPURedactionWorker()

@pytest.fixture
def sample_image():
    # Create a simple test image
    return np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)

@pytest.fixture
def sample_job_data():
    return {
        'reportId': 'test-report-123',
        'encryptedData': {'ciphertext': 'test', 'iv': 'test', 'salt': 'test'},
        'wrappedKey': 'test-key',
        'contentHash': 'test-hash',
        'files': [
            {
                'key': 'test-file.jpg',
                'originalName': 'test-image.jpg',
                'url': 'https://example.com/test-file.jpg'
            }
        ]
    }

class TestGPURedactionWorker:
    
    def test_worker_initialization(self, worker):
        """Test that worker initializes correctly"""
        assert worker.device is not None
        assert hasattr(worker, 'ocr_processor')
        assert hasattr(worker, 'ocr_model')
        assert hasattr(worker, 'whisper_model')
        assert hasattr(worker, 'nlp')
    
    def test_face_detection(self, worker, sample_image):
        """Test face detection and redaction"""
        with patch('face_recognition.face_locations') as mock_face_locations:
            mock_face_locations.return_value = [(10, 90, 90, 10)]  # Mock face location
            
            redacted_image, face_count = worker.detect_and_redact_faces(sample_image)
            
            assert face_count == 1
            assert redacted_image.shape == sample_image.shape
            mock_face_locations.assert_called_once()
    
    def test_text_extraction(self, worker):
        """Test OCR text extraction and PII redaction"""
        # Create a simple test image
        test_image = Image.new('RGB', (200, 100), color='white')
        
        with patch.object(worker.ocr_model, 'generate') as mock_generate, \
             patch.object(worker.ocr_processor, 'batch_decode') as mock_decode:
            
            mock_generate.return_value = [1, 2, 3]  # Mock token IDs
            mock_decode.return_value = ['John Doe phone: 555-1234']
            
            redacted_text, pii_count = worker.extract_and_redact_text(test_image)
            
            assert isinstance(redacted_text, str)
            assert pii_count >= 0
            mock_generate.assert_called_once()
            mock_decode.assert_called_once()
    
    @patch('whisper.load_model')
    def test_audio_processing(self, mock_whisper, worker):
        """Test audio transcription and PII redaction"""
        mock_model = Mock()
        mock_model.transcribe.return_value = {
            'text': 'Hello, my name is John Doe and my phone is 555-1234'
        }
        worker.whisper_model = mock_model
        
        result = worker.process_audio('/tmp/test.mp3')
        
        assert 'original_transcript' in result
        assert 'redacted_transcript' in result
        assert 'pii_entities_found' in result
        assert result['pii_entities_found'] >= 0
    
    @pytest.mark.asyncio
    async def test_process_report(self, worker, sample_job_data):
        """Test complete report processing"""
        with patch.object(worker, 'process_file') as mock_process_file:
            mock_process_file.return_value = {
                'originalName': 'test-image.jpg',
                'fileKey': 'test-file.jpg',
                'facesRedacted': 2,
                'piiRedacted': 3,
                'processed': True
            }
            
            result = await worker.process_report(sample_job_data)
            
            assert result['reportId'] == 'test-report-123'
            assert result['status'] == 'completed'
            assert 'redactionSummary' in result
            assert result['redactionSummary']['facesRedacted'] == 2
            assert result['redactionSummary']['piiRedacted'] == 3
            assert result['redactionSummary']['filesProcessed'] == 1

if __name__ == '__main__':
    pytest.main([__file__])