import { ethers } from 'ethers';

const CONTRACT_ABI = [
  "function submitReport(bytes32 contentHash, string memory status) external",
  "function getReport(bytes32 contentHash) external view returns (uint256 timestamp, string memory status, address reporter)",
  "function updateStatus(bytes32 contentHash, string memory newStatus) external",
  "event ReportSubmitted(bytes32 indexed contentHash, address indexed reporter, uint256 timestamp)"
];

export class EthereumProof {
  constructor(contractAddress, providerUrl) {
    this.contractAddress = contractAddress;
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.provider);
  }

  async connectWallet() {
    if (!window.ethereum) throw new Error('MetaMask not found');
    
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    this.signer = signer;
    this.contractWithSigner = this.contract.connect(signer);
    
    return await signer.getAddress();
  }

  async submitProof(contentHash, status = "submitted") {
    if (!this.contractWithSigner) throw new Error('Wallet not connected');
    
    const hashBytes = ethers.keccak256(ethers.toUtf8Bytes(contentHash));
    const tx = await this.contractWithSigner.submitReport(hashBytes, status);
    return tx.hash;
  }

  async getProof(contentHash) {
    const hashBytes = ethers.keccak256(ethers.toUtf8Bytes(contentHash));
    const result = await this.contract.getReport(hashBytes);
    return {
      timestamp: Number(result[0]),
      status: result[1],
      reporter: result[2]
    };
  }

  async updateProof(contentHash, newStatus) {
    if (!this.contractWithSigner) throw new Error('Wallet not connected');
    
    const hashBytes = ethers.keccak256(ethers.toUtf8Bytes(contentHash));
    const tx = await this.contractWithSigner.updateStatus(hashBytes, newStatus);
    return tx.hash;
  }
}