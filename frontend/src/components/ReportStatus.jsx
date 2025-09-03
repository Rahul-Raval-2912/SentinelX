import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { EthereumProof } from '../utils/ethereum';

export default function ReportStatus({ reportId, contentHash, ethTxHash }) {
  const [status, setStatus] = useState('processing');
  const [ethProof, setEthProof] = useState(null);
  const [redactionPreview, setRedactionPreview] = useState(null);

  useEffect(() => {
    fetchStatus();
    if (contentHash) fetchEthProof();
  }, [reportId, contentHash]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/reports/${reportId}/status`);
      const data = await response.json();
      setStatus(data.status);
      setRedactionPreview(data.redactionPreview);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const fetchEthProof = async () => {
    try {
      const eth = new EthereumProof(
        "0x1234567890123456789012345678901234567890",
        "https://rpc.ankr.com/eth_sepolia"
      );
      const proof = await eth.getProof(contentHash);
      setEthProof(proof);
    } catch (error) {
      console.error('Failed to fetch Ethereum proof:', error);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircle className="text-green-600" size={24} />;
      case 'processing': return <Clock className="text-yellow-600" size={24} />;
      case 'failed': return <AlertCircle className="text-red-600" size={24} />;
      default: return <Clock className="text-gray-600" size={24} />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed': return 'Report processed and redacted successfully';
      case 'processing': return 'GPU worker processing redaction...';
      case 'failed': return 'Processing failed - please try again';
      default: return 'Initializing...';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Report Status</h2>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md">
          {getStatusIcon()}
          <div>
            <div className="font-medium">Processing Status</div>
            <div className="text-sm text-gray-600">{getStatusText()}</div>
            <div className="text-xs text-gray-500 mt-1">Report ID: {reportId}</div>
          </div>
        </div>

        {ethTxHash && (
          <div className="p-4 bg-blue-50 rounded-md">
            <div className="font-medium text-blue-800">Ethereum Proof</div>
            <div className="text-sm text-blue-600 mt-1">
              Transaction: 
              <a 
                href={`https://sepolia.etherscan.io/tx/${ethTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline inline-flex items-center gap-1"
              >
                {ethTxHash.slice(0, 10)}...{ethTxHash.slice(-8)}
                <ExternalLink size={12} />
              </a>
            </div>
            {ethProof && (
              <div className="text-xs text-blue-500 mt-1">
                Timestamp: {new Date(ethProof.timestamp * 1000).toLocaleString()}
                <br />
                Status: {ethProof.status}
              </div>
            )}
          </div>
        )}

        {redactionPreview && (
          <div className="p-4 bg-green-50 rounded-md">
            <div className="font-medium text-green-800">Redaction Summary</div>
            <div className="text-sm text-green-600 mt-1">
              • {redactionPreview.facesRedacted || 0} faces detected and redacted
              <br />
              • {redactionPreview.piiRedacted || 0} PII entities removed
              <br />
              • {redactionPreview.filesProcessed || 0} files processed
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-md">
          <strong>Security Note:</strong> All data remains encrypted end-to-end. 
          Only authorized recipients can decrypt the content. 
          GPU processing on Akash ensures no persistent storage of sensitive data.
        </div>
      </div>
    </div>
  );
}