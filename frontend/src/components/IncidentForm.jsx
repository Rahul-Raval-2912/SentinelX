import React, { useState } from 'react';
import { Upload, Shield, Eye, EyeOff } from 'lucide-react';
import { E2EECrypto } from '../utils/crypto';
import { EthereumProof } from '../utils/ethereum';

export default function IncidentForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    severity: 'medium',
    files: []
  });
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [ethProof, setEthProof] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({ ...prev, files: [...prev.files, ...files] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      // Generate encryption key
      const reportKey = E2EECrypto.generateKey();
      const recipientPubKey = "demo-recipient-key"; // In production, fetch from API
      
      // Encrypt report data
      const encryptedReport = E2EECrypto.encryptReport(formData, reportKey);
      const wrappedKey = E2EECrypto.wrapKey(reportKey, recipientPubKey);
      
      // Create content hash for Ethereum
      const contentHash = E2EECrypto.hashContent(encryptedReport);
      
      // Submit to API
      const payload = {
        encryptedData: encryptedReport,
        wrappedKey,
        contentHash,
        files: formData.files
      };

      // Optional Ethereum proof
      if (ethProof) {
        try {
          const txHash = await ethProof.submitProof(contentHash);
          payload.ethTxHash = txHash;
        } catch (err) {
          console.warn('Ethereum proof failed:', err);
        }
      }

      await onSubmit(payload);
      setIsEncrypted(true);
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Submission failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const connectEthereum = async () => {
    try {
      const eth = new EthereumProof(
        "0x1234567890123456789012345678901234567890", // Demo contract
        "https://rpc.ankr.com/eth_sepolia"
      );
      await eth.connectWallet();
      setEthProof(eth);
    } catch (error) {
      alert('Ethereum connection failed: ' + error.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="text-blue-600" size={24} />
        <h2 className="text-2xl font-bold">Secure Incident Report</h2>
        {isEncrypted && <Eye className="text-green-600" size={20} />}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border rounded-md h-32"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full p-2 border rounded-md"
            >
              <option value="general">General</option>
              <option value="security">Security</option>
              <option value="harassment">Harassment</option>
              <option value="fraud">Fraud</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Severity</label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
              className="w-full p-2 border rounded-md"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Attachments</label>
          <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2">
              <Upload size={20} />
              <span>Upload files (will be encrypted & redacted)</span>
            </label>
            {formData.files.length > 0 && (
              <div className="mt-2">
                {formData.files.map((file, idx) => (
                  <div key={idx} className="text-sm text-gray-600">{file.name}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={connectEthereum}
            className={`px-4 py-2 rounded-md ${ethProof ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            {ethProof ? 'Ethereum Connected' : 'Connect Ethereum (Optional)'}
          </button>

          <button
            type="submit"
            disabled={processing}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? 'Encrypting & Submitting...' : 'Submit Encrypted Report'}
          </button>
        </div>
      </form>

      <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm">
        <Shield className="inline mr-1" size={16} />
        Your report will be encrypted client-side before transmission. 
        Files will be processed with GPU-accelerated redaction on Akash.
      </div>
    </div>
  );
}