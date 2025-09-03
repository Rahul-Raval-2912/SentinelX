const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const AWS = require('aws-sdk');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 8000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// Redis client for job queue
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// S3 client for encrypted storage
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|mp3|wav/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Submit encrypted report
app.post('/api/reports', upload.array('files', 10), async (req, res) => {
  try {
    const reportId = uuidv4();
    const { encryptedData, wrappedKey, contentHash, ethTxHash } = req.body;
    
    // Validate required fields
    if (!encryptedData || !wrappedKey || !contentHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store encrypted report metadata
    const reportMetadata = {
      reportId,
      contentHash,
      ethTxHash,
      timestamp: new Date().toISOString(),
      status: 'received',
      filesCount: req.files?.length || 0
    };

    // Upload encrypted files to S3
    const fileUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileKey = `reports/${reportId}/${uuidv4()}-${file.originalname}`;
        
        // Encrypt file content
        const cipher = crypto.createCipher('aes-256-gcm', wrappedKey);
        let encryptedFile = cipher.update(file.buffer);
        encryptedFile = Buffer.concat([encryptedFile, cipher.final()]);
        
        const uploadParams = {
          Bucket: process.env.S3_BUCKET || 'incident-reports-encrypted',
          Key: fileKey,
          Body: encryptedFile,
          ContentType: 'application/octet-stream',
          ServerSideEncryption: 'AES256',
          Metadata: {
            'original-name': file.originalname,
            'report-id': reportId
          }
        };

        const result = await s3.upload(uploadParams).promise();
        fileUrls.push({
          key: fileKey,
          url: result.Location,
          originalName: file.originalname
        });
      }
    }

    // Create job for GPU worker
    const jobData = {
      reportId,
      encryptedData,
      wrappedKey,
      contentHash,
      files: fileUrls,
      timestamp: new Date().toISOString()
    };

    // Add to Redis queue
    await redisClient.lPush('gpu-worker-queue', JSON.stringify(jobData));

    // Store report metadata
    await redisClient.hSet(`report:${reportId}`, {
      ...reportMetadata,
      jobData: JSON.stringify(jobData)
    });

    res.json({
      reportId,
      status: 'queued',
      message: 'Report received and queued for processing'
    });

  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get report status
app.get('/api/reports/:reportId/status', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const reportData = await redisClient.hGetAll(`report:${reportId}`);
    
    if (!reportData.reportId) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check for processing results
    const resultData = await redisClient.hGetAll(`result:${reportId}`);
    
    res.json({
      reportId,
      status: reportData.status,
      timestamp: reportData.timestamp,
      filesCount: parseInt(reportData.filesCount) || 0,
      redactionPreview: resultData.redactionSummary ? JSON.parse(resultData.redactionSummary) : null,
      ethTxHash: reportData.ethTxHash
    });

  } catch (error) {
    console.error('Status fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook for GPU worker results
app.post('/api/webhook/processing-complete', async (req, res) => {
  try {
    const { reportId, status, redactionSummary, processedFiles } = req.body;
    
    // Update report status
    await redisClient.hSet(`report:${reportId}`, 'status', status);
    
    // Store processing results
    await redisClient.hSet(`result:${reportId}`, {
      redactionSummary: JSON.stringify(redactionSummary),
      processedFiles: JSON.stringify(processedFiles),
      completedAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize Redis connection
redisClient.connect().catch(console.error);

app.listen(PORT, () => {
  console.log(`Gateway API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});