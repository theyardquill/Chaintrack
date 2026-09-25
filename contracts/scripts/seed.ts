import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// One-shot local seeding for ChainTrack dev/demo and for the headless E2E.
//
//   pnpm --filter contracts exec hardhat node   (a running node on :8545)
//   pnpm --filter contracts seed
//
// 1. Deploys a fresh ChainTrack contract (owner = seed sender Alice).
// 2. Generates deterministic wallets for the three demo users from the
//    standard Hardhat mnemonic and writes them (incl. private keys) to a
//    git-ignored demo-wallets.json for local testing only.
// 3. Registers Alice (SENDER), Bob (RECEIVER) and Courier (AGENT) with those
//    wallets.
// 4. Books a sample package (CTK-9000, 0.1 ETH escrow) so the Track UI shows
//    a real on-chain record immediately.
// 5. Writes the chain-1337 address into web/src/contracts/deployments.json.
//
// The app itself never signs with the generated keys; MetaMask (or the E2E
// RPC stub) handles signing. demo-wallets.json is git-ignored on purpose.
// ---------------------------------------------------------------------------

function roleNum(role: "SENDER" | "RECEIVER" | "AGENT"): number {
  return { SENDER: 1, RECEIVER: 2, AGENT: 3 }[role];
}

async function main() {
  // Alice is accounts[0] — she is both the registry owner/deployer and the
  // demo SENDER. Bob (RECEIVER) and Courier (AGENT) are accounts[1..2]. These
  // match the canonical Hardhat accounts used by the demo store and the E2E.
  const [alice, bob, courier] = await ethers.getSigners();

  console.log("Deploying ChainTrack (fresh)…");
  const ChainTrack = await ethers.getContractFactory("ChainTrack");
  const ct = await ChainTrack.deploy();
  await ct.waitForDeployment();
  const address = await ct.getAddress();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  const users = [
    { name: "Alice Sender", phone: "+254711000001", role: "SENDER" as const, signer: alice },
    { name: "Bob Receiver", phone: "+254711000002", role: "RECEIVER" as const, signer: bob },
    { name: "Courier Corp", phone: "+254711000003", role: "AGENT" as const, signer: courier },
  ];

  console.log("Registering demo users…");
  for (const u of users) {
    const tx = await ct.registerUser(
      u.signer.address,
      u.name,
      u.phone,
      roleNum(u.role)
    );
    const receipt = await tx.wait();
    console.log(`  #${receipt?.logs.length ?? "?"} ${u.name.padEnd(14)} ${u.role.padEnd(8)} ${u.signer.address}`);
  }

  const deliveryCode = "SEED-4242";
  await ct
    .connect(alice)
    .bookShipment(
      "CTK-9000",
      "seed electronics",
      2,
      "M",
      2, // Bob = user #2 (registered in table order)
      ethers.keccak256(ethers.toUtf8Bytes(deliveryCode)),
      "ETH",
      { value: ethers.parseEther("0.1") }
    );
  const packageId = await ct.packageIdByCode("CTK-9000");
  console.log(`Booked CTK-9000 → package #${packageId}, 0.1 ETH escrow (delivery code ${deliveryCode})`);

  // Persist deployment address (same shape as scripts/deploy.ts).
  const deploymentsPath = path.join(__dirname, "../../web/src/contracts/deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  if (!deployments.networks[chainId]) deployments.networks[chainId] = {};
  deployments.networks[chainId].ChainTrack = { address };
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  // Persist generated demo wallets (local test keys only — git-ignored).
  const walletsPath = path.join(__dirname, "../../web/src/contracts/demo-wallets.json");
  const wallets = users.map((u, i) => ({
    name: u.name,
    role: u.role,
    index: i,
    address: u.signer.address,
    privateKey: u.signer.privateKey,
  }));
  fs.writeFileSync(
    walletsPath,
    JSON.stringify(
      {
        chainId,
        mnemonic: process.env.HARDHAT_MNEMONIC ?? "test test test test test test test test test test test junk",
        hdPath: "m/44'/60'/0'/0/",
        wallets,
      },
      null,
      2
    )
  );

  console.log("\nDeployment saved -> web/src/contracts/deployments.json");
  console.log("Seed wallets saved -> web/src/contracts/demo-wallets.json (git-ignored)");
  console.log(`Contract: ${address} on chain ${chainId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });