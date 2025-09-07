# SentinelX - Secure Incident Reporting Platform

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/YOUR_USERNAME/sentinelx-hackathon)
[![Hackathon](https://img.shields.io/badge/Hack%20Odisha-orange)](https://hackodisha.com)
[![Akash Network](https://img.shields.io/badge/Akash-Network-red)](https://akash.network)

End-to-end encrypted incident reporting with GPU-accelerated redaction on Akash Network

Complete decentralized solution for secure incident reporting with blockchain verification and AI-powered analytics

## Quick Start

### Local Demo
```bash
cd local-test
npm install
npm start
# Open http://localhost:3000
```

### Deploy to Akash Network
```bash
akash tx deployment create akash-deploy.yml --from wallet --chain-id akashnet-2
```

### Demo Features
- Submit incident reports with file uploads
- AI-powered chatbot assistance
- Real-time analytics dashboard
- Blockchain proof simulation
- Mobile-responsive design

## Architecture

- **Frontend**: React + Vite with client-side E2EE encryption
- **Gateway API**: Node.js/Express for auth and job orchestration  
- **GPU Worker**: Python FastAPI with OCR/NER redaction on Akash
- **Ethereum**: Smart contract for proof-of-integrity
- **Storage**: S3-compatible encrypted blob storage

## Security Features

- **End-to-End Encryption**: AES-256-GCM client-side encryption
- **Zero-Knowledge Processing**: GPU workers process encrypted data only
- **PII Redaction**: Face detection, OCR, and NER-based redaction
- **Blockchain Proof**: Immutable audit trail on Ethereum

## Project Structure

```
├── akash-deploy.yml          # Akash SDL deployment config
├── frontend/                 # React frontend with E2EE
├── gateway-api/             # Node.js API server
├── gpu-worker/              # Python GPU processing worker
├── ethereum/                # Smart contracts
└── README.md               # This file
```

## Akash Network Integration

The platform leverages Akash decentralized compute for:
- GPU-accelerated ML processing (face detection, OCR, NER)
- Cost-effective compute (70% cheaper than traditional cloud)
- Zero-knowledge processing (no persistent data storage)
- Global distribution across multiple providers

## Ethereum Integration

Smart contract provides:
- Proof-of-integrity for incident reports
- Immutable audit trail with timestamps
- Status tracking and verification
- Gas-optimized operations

## Prize Track Compatibility

- Akash Network: GPU workloads, reproducible SDL, decentralized compute
- Ethereum: Proof-of-integrity, immutable audit, gas optimization
- Security/Privacy: E2EE, zero-knowledge processing, PII redaction

## License

MIT License - see LICENSE file for details