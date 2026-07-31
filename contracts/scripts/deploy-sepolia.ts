import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ethers, network } from "hardhat";

const DEFAULT_USDC_MOCK = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const DEFAULT_CUSDC_MOCK = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("This script deploys the production demo vault to Sepolia only.");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer configured. Add PRIVATE_KEY to contracts/.env.");
  }

  const underlyingToken = process.env.USDC_MOCK_ADDRESS ?? DEFAULT_USDC_MOCK;
  const confidentialToken = process.env.CUSDC_MOCK_ADDRESS ?? DEFAULT_CUSDC_MOCK;
  const depositWindow = Number(process.env.DEPOSIT_WINDOW_SECONDS ?? "120");
  const drawInterval = Number(process.env.DRAW_INTERVAL_SECONDS ?? "180");
  if (!Number.isSafeInteger(depositWindow) || depositWindow <= 0) {
    throw new Error("DEPOSIT_WINDOW_SECONDS must be a positive integer.");
  }
  if (!Number.isSafeInteger(drawInterval) || drawInterval <= 0) {
    throw new Error("DRAW_INTERVAL_SECONDS must be a positive integer.");
  }

  for (const [label, address] of [
    ["USDC Mock", underlyingToken],
    ["cUSDCMock", confidentialToken],
  ] as const) {
    if ((await ethers.provider.getCode(address)) === "0x") {
      throw new Error(`${label} has no contract code at ${address} on Sepolia.`);
    }
  }

  console.log(`Deploying ConfiPool from ${deployer.address}`);
  console.log(`Underlying USDC Mock: ${underlyingToken}`);
  console.log(`Confidential cUSDCMock: ${confidentialToken}`);
  console.log(`Deposit window: ${depositWindow}s · draw delay: ${drawInterval}s`);

  const factory = await ethers.getContractFactory("ConfidentialPrizeVault", deployer);
  const vault = await factory.deploy(
    confidentialToken,
    underlyingToken,
    depositWindow,
    drawInterval,
    deployer.address,
  );
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  const receipt = await vault.deploymentTransaction()?.wait();
  const deployment = {
    chainId: 11155111,
    network: "sepolia",
    deployer: deployer.address,
    vault: vaultAddress,
    underlyingToken,
    confidentialToken,
    depositWindow,
    drawInterval,
    deployedAt: new Date().toISOString(),
    transactionHash: receipt?.hash ?? null,
  };

  const outputDir = resolve(__dirname, "..", "deployments");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "sepolia.json");
  writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log(`ConfiPool vault deployed: ${vaultAddress}`);
  console.log(`Deployment written to ${outputPath}`);
  console.log(`Frontend env: VITE_CONFIPOOL_VAULT_ADDRESS=${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
