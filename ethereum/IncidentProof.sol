// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title IncidentProof
 * @dev Smart contract for storing proof-of-integrity for incident reports
 * @notice Stores content hashes with timestamps and status updates
 */
contract IncidentProof is Ownable, ReentrancyGuard {
    
    struct Report {
        bytes32 contentHash;
        address reporter;
        uint256 timestamp;
        string status;
        bool exists;
    }
    
    mapping(bytes32 => Report) public reports;
    mapping(address => bytes32[]) public reportsByAddress;
    
    event ReportSubmitted(
        bytes32 indexed contentHash,
        address indexed reporter,
        uint256 timestamp,
        string status
    );
    
    event StatusUpdated(
        bytes32 indexed contentHash,
        string previousStatus,
        string newStatus,
        address updatedBy
    );
    
    modifier reportExists(bytes32 contentHash) {
        require(reports[contentHash].exists, "Report does not exist");
        _;
    }
    
    modifier onlyReporter(bytes32 contentHash) {
        require(
            reports[contentHash].reporter == msg.sender || msg.sender == owner(),
            "Only reporter or owner can update"
        );
        _;
    }
    
    /**
     * @dev Submit a new incident report proof
     * @param contentHash Keccak256 hash of the encrypted report content
     * @param status Initial status of the report
     */
    function submitReport(bytes32 contentHash, string memory status) 
        external 
        nonReentrant 
    {
        require(contentHash != bytes32(0), "Invalid content hash");
        require(bytes(status).length > 0, "Status cannot be empty");
        require(!reports[contentHash].exists, "Report already exists");
        
        reports[contentHash] = Report({
            contentHash: contentHash,
            reporter: msg.sender,
            timestamp: block.timestamp,
            status: status,
            exists: true
        });
        
        reportsByAddress[msg.sender].push(contentHash);
        
        emit ReportSubmitted(contentHash, msg.sender, block.timestamp, status);
    }
    
    /**
     * @dev Get report details by content hash
     * @param contentHash The content hash to query
     * @return timestamp When the report was submitted
     * @return status Current status of the report
     * @return reporter Address that submitted the report
     */
    function getReport(bytes32 contentHash) 
        external 
        view 
        reportExists(contentHash)
        returns (uint256 timestamp, string memory status, address reporter) 
    {
        Report memory report = reports[contentHash];
        return (report.timestamp, report.status, report.reporter);
    }
    
    /**
     * @dev Update the status of an existing report
     * @param contentHash The content hash of the report to update
     * @param newStatus The new status to set
     */
    function updateStatus(bytes32 contentHash, string memory newStatus) 
        external 
        reportExists(contentHash)
        onlyReporter(contentHash)
        nonReentrant
    {
        require(bytes(newStatus).length > 0, "Status cannot be empty");
        
        string memory previousStatus = reports[contentHash].status;
        reports[contentHash].status = newStatus;
        
        emit StatusUpdated(contentHash, previousStatus, newStatus, msg.sender);
    }
    
    /**
     * @dev Get all report hashes submitted by an address
     * @param reporter The address to query
     * @return Array of content hashes
     */
    function getReportsByAddress(address reporter) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return reportsByAddress[reporter];
    }
    
    /**
     * @dev Verify if a report exists
     * @param contentHash The content hash to check
     * @return exists Whether the report exists
     */
    function reportExists(bytes32 contentHash) 
        external 
        view 
        returns (bool exists) 
    {
        return reports[contentHash].exists;
    }
    
    /**
     * @dev Get the total number of reports submitted by an address
     * @param reporter The address to query
     * @return count Number of reports
     */
    function getReportCount(address reporter) 
        external 
        view 
        returns (uint256 count) 
    {
        return reportsByAddress[reporter].length;
    }
    
    /**
     * @dev Emergency function to update any report status (owner only)
     * @param contentHash The content hash of the report
     * @param newStatus The new status to set
     */
    function emergencyUpdateStatus(bytes32 contentHash, string memory newStatus) 
        external 
        onlyOwner 
        reportExists(contentHash)
        nonReentrant
    {
        string memory previousStatus = reports[contentHash].status;
        reports[contentHash].status = newStatus;
        
        emit StatusUpdated(contentHash, previousStatus, newStatus, msg.sender);
    }
}