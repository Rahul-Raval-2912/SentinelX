const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IncidentProof", function () {
  let incidentProof;
  let owner;
  let reporter;
  let other;

  beforeEach(async function () {
    [owner, reporter, other] = await ethers.getSigners();
    
    const IncidentProof = await ethers.getContractFactory("IncidentProof");
    incidentProof = await IncidentProof.deploy();
    await incidentProof.deployed();
  });

  describe("Report Submission", function () {
    it("Should submit a new report", async function () {
      const contentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
      const status = "submitted";

      await expect(incidentProof.connect(reporter).submitReport(contentHash, status))
        .to.emit(incidentProof, "ReportSubmitted")
        .withArgs(contentHash, reporter.address, anyValue, status);

      const report = await incidentProof.getReport(contentHash);
      expect(report.status).to.equal(status);
      expect(report.reporter).to.equal(reporter.address);
    });

    it("Should reject duplicate reports", async function () {
      const contentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
      
      await incidentProof.connect(reporter).submitReport(contentHash, "submitted");
      
      await expect(
        incidentProof.connect(reporter).submitReport(contentHash, "submitted")
      ).to.be.revertedWith("Report already exists");
    });
  });

  describe("Status Updates", function () {
    it("Should allow reporter to update status", async function () {
      const contentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
      
      await incidentProof.connect(reporter).submitReport(contentHash, "submitted");
      
      await expect(incidentProof.connect(reporter).updateStatus(contentHash, "processing"))
        .to.emit(incidentProof, "StatusUpdated")
        .withArgs(contentHash, "submitted", "processing", reporter.address);
    });

    it("Should reject unauthorized status updates", async function () {
      const contentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test content"));
      
      await incidentProof.connect(reporter).submitReport(contentHash, "submitted");
      
      await expect(
        incidentProof.connect(other).updateStatus(contentHash, "processing")
      ).to.be.revertedWith("Only reporter or owner can update");
    });
  });
});