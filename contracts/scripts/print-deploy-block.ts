import { ethers } from "hardhat";

async function main() {
  const hash = "0x39b6835f91f669bb7f84ab6df35103c21b1a9e79d011e7587c5bc9c40af5d760";
  const receipt = await ethers.provider.getTransactionReceipt(hash);
  console.log(receipt?.blockNumber ?? "missing");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
