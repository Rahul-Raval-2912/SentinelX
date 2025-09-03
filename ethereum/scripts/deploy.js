const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying IncidentProof contract...");

  // Get the ContractFactory and Signers
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy the contract
  const IncidentProof = await ethers.getContractFactory("IncidentProof");
  const incidentProof = await IncidentProof.deploy();

  await incidentProof.deployed();

  console.log("IncidentProof deployed to:", incidentProof.address);
  console.log("Transaction hash:", incidentProof.deployTransaction.hash);

  // Wait for a few confirmations
  console.log("Waiting for confirmations...");
  await incidentProof.deployTransaction.wait(5);

  console.log("Deployment completed!");
  console.log("Contract address:", incidentProof.address);
  console.log("Deployer address:", deployer.address);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: incidentProof.address,
    deployerAddress: deployer.address,
    transactionHash: incidentProof.deployTransaction.hash,
    network: hre.network.name,
    timestamp: new Date().toISOString()
  };

  console.log("Deployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });