import { ethers } from "hardhat";

async function main() {
  const v = "0x335339161E31fD94fF5A5d0595eC7526AFe9373F";
  const c = await ethers.getContractAt("ConfidentialPrizeVault", v);
  const owner = await c.owner();
  const count = await c.depositorCount();
  const drawCount = await c.drawCount();
  const genesis = await c.genesis();
  const next = await c.nextOpenableAt();
  console.log(JSON.stringify({ owner, depositorCount: count.toString(), drawCount: drawCount.toString(), genesis: genesis.toString(), nextOpenableAt: next.toString() }, null, 2));

  const filter = c.filters.Deposited();
  const logs = await c.queryFilter(filter, 11621678, "latest");
  console.log("Deposited logs:", logs.length);
  for (const log of logs.slice(-5)) {
    console.log(" ", log.blockNumber, log.transactionHash, log.args?.account);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
