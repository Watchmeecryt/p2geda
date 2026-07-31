import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const deploymentPath = resolve(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as {
    vault: string;
    underlyingToken: string;
    confidentialToken: string;
  };

  const vault = await ethers.getContractAt("ConfidentialPrizeVault", deployment.vault);

  const [
    confidentialToken,
    underlyingToken,
    drawInterval,
    owner,
    drawsCompleted,
    depositorCount,
    prizeConfigured,
    reserveFunded,
    minDraws,
    maxDepositors,
  ] = await Promise.all([
    vault.confidentialToken(),
    vault.underlyingToken(),
    vault.drawInterval(),
    vault.owner(),
    vault.drawsCompleted(),
    vault.depositorCount(),
    vault.prizePerDrawConfigured(),
    vault.prizeReserveFunded(),
    vault.MIN_DRAWS_BEFORE_PUBLIC_REVEAL(),
    vault.MAX_DEPOSITORS(),
  ]);

  console.log(`network:              ${network.name}`);
  console.log(`vault:                ${deployment.vault}`);
  console.log(`owner:                ${owner}`);
  console.log(`confidential token:   ${confidentialToken}`);
  console.log(`underlying token:     ${underlyingToken}`);
  console.log(`draw interval:        ${drawInterval}s`);
  console.log(`draws completed:      ${drawsCompleted}`);
  console.log(`depositors:           ${depositorCount} (max ${maxDepositors})`);
  console.log(`prize configured:     ${prizeConfigured}`);
  console.log(`reserve funded:       ${reserveFunded}`);
  console.log(`reveal after draws:   ${minDraws}`);

  const wiringOk =
    confidentialToken.toLowerCase() === deployment.confidentialToken.toLowerCase() &&
    underlyingToken.toLowerCase() === deployment.underlyingToken.toLowerCase();

  if (!wiringOk) {
    throw new Error("Deployed token wiring does not match the recorded deployment.");
  }
  console.log("token wiring:         OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
