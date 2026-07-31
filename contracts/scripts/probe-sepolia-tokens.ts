import { ethers } from "hardhat";

const USDC_MOCK = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const CUSDC_MOCK = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function MAX_MINT_PER_CALL() view returns (uint256)",
];

const WRAPPER_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function underlying() view returns (address)",
  "function rate() view returns (uint256)",
  "function wrap(address to, uint256 amount)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const who = await signer.getAddress();
  console.log(`probing as ${who}\n`);

  const usdc = new ethers.Contract(USDC_MOCK, ERC20_ABI, signer);
  console.log("— USDC Mock —");
  for (const fn of ["name", "symbol", "decimals", "totalSupply", "MAX_MINT_PER_CALL"] as const) {
    try {
      console.log(`  ${fn}: ${await usdc[fn]()}`);
    } catch {
      console.log(`  ${fn}: (absent)`);
    }
  }
  console.log(`  balanceOf(me): ${await usdc.balanceOf(who)}`);
  try {
    await usdc.mint.staticCall(who, 1_000_000n);
    console.log("  mint(address,uint256): callable by anyone -> faucet OK");
  } catch (error) {
    console.log(`  mint(address,uint256): NOT callable -> ${(error as Error).message.slice(0, 140)}`);
  }

  const cUsdc = new ethers.Contract(CUSDC_MOCK, WRAPPER_ABI, signer);
  console.log("\n— cUSDCMock wrapper —");
  for (const fn of ["name", "symbol", "decimals", "underlying", "rate"] as const) {
    try {
      console.log(`  ${fn}: ${await cUsdc[fn]()}`);
    } catch {
      console.log(`  ${fn}: (absent)`);
    }
  }
  try {
    await cUsdc.wrap.staticCall(who, 1_000_000n);
    console.log("  wrap(address,uint256): signature present");
  } catch (error) {
    const message = (error as Error).message;
    const known = /allowance|balance|insufficient|ERC20/i.test(message);
    console.log(
      `  wrap(address,uint256): ${known ? "signature present (reverts on allowance, expected)" : message.slice(0, 140)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
