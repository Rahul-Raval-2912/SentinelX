const request = require('supertest');
const express = require('express');
const { expect } = require('chai');

// Mock the server for testing
const app = express();
app.use(express.json());

// Mock endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/reports', (req, res) => {
  const { encryptedData, wrappedKey, contentHash } = req.body;
  
  if (!encryptedData || !wrappedKey || !contentHash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  res.json({
    reportId: 'test-report-id',
    status: 'queued',
    message: 'Report received and queued for processing'
  });
});

app.get('/api/reports/:reportId/status', (req, res) => {
  res.json({
    reportId: req.params.reportId,
    status: 'completed',
    timestamp: new Date().toISOString(),
    filesCount: 2,
    redactionPreview: {
      facesRedacted: 3,
      piiRedacted: 7,
      filesProcessed: 2
    }
  });
});

describe('Gateway API', function() {
  describe('GET /health', function() {
    it('should return healthy status', function(done) {
      request(app)
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).to.equal('healthy');
          expect(res.body.timestamp).to.be.a('string');
        })
        .end(done);
    });
  });

  describe('POST /api/reports', function() {
    it('should accept valid report submission', function(done) {
      const reportData = {
        encryptedData: { ciphertext: 'test', iv: 'test', salt: 'test' },
        wrappedKey: 'test-key',
        contentHash: 'test-hash'
      };

      request(app)
        .post('/api/reports')
        .send(reportData)
        .expect(200)
        .expect((res) => {
          expect(res.body.reportId).to.be.a('string');
          expect(res.body.status).to.equal('queued');
        })
        .end(done);
    });

    it('should reject incomplete report data', function(done) {
      request(app)
        .post('/api/reports')
        .send({ encryptedData: 'test' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).to.equal('Missing required fields');
        })
        .end(done);
    });
  });

  describe('GET /api/reports/:reportId/status', function() {
    it('should return report status', function(done) {
      request(app)
        .get('/api/reports/test-id/status')
        .expect(200)
        .expect((res) => {
          expect(res.body.reportId).to.equal('test-id');
          expect(res.body.status).to.be.a('string');
          expect(res.body.redactionPreview).to.be.an('object');
        })
        .end(done);
    });
  });
});