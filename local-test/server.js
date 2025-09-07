const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'SentinelX Local Test',
    version: '1.0.0'
  });
});

// Submit report
app.post('/api/reports', (req, res) => {
  const reportId = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  
  console.log('📝 Report submitted:', reportId, req.body);
  
  res.json({ 
    reportId: reportId,
    status: 'received',
    message: 'Report submitted for processing',
    timestamp: new Date().toISOString(),
    processing: {
      gpuWorker: 'local-test-worker',
      estimatedTime: '2-3 seconds'
    }
  });
});

// Get report status
app.get('/api/reports/:id/status', (req, res) => {
  const reportId = req.params.id;
  
  console.log('📊 Status check for:', reportId);
  
  res.json({
    reportId: reportId,
    status: 'completed',
    timestamp: new Date().toISOString(),
    redactionPreview: {
      facesRedacted: Math.floor(Math.random() * 5) + 1,
      piiRedacted: Math.floor(Math.random() * 10) + 3,
      filesProcessed: 1
    },
    processing: {
      gpuWorker: 'local-test-worker',
      processingTime: (Math.random() * 2 + 1).toFixed(1) + 's',
      modelsUsed: ['face-detection', 'ocr-trocr', 'ner-spacy']
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 SentinelX running at http://localhost:${PORT}`);
  console.log('🔐 Ready for testing!');
});