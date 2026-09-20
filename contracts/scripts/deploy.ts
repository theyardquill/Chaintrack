import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying ChainTrack contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Account has no funds. Please fund the account or use a different account.");
  }

  const ChainTrack = await ethers.getContractFactory("ChainTrack");
  const chainTrack = await ChainTrack.deploy();

  await chainTrack.waitForDeployment();

  const address = await chainTrack.getAddress();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  console.log("ChainTrack deployed to:", address);
  console.log("Network chain ID:", chainId);

  const deploymentsPath = path.join(__dirname, "../../web/src/contracts/deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  if (!deployments.networks[chainId]) {
    deployments.networks[chainId] = {};
  }

  deployments.networks[chainId].ChainTrack = {
    address: address,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Deployment info saved to web/src/contracts/deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });