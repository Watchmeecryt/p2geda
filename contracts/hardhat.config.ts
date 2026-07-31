import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import type { HardhatUserConfig } from "hardhat/config";
import "dotenv/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim() ?? "";
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL?.trim() ?? "https://ethereum-sepolia-rpc.publicnode.com";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
      timeout: 180_000,
      url: SEPOLIA_RPC_URL,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      metadata: { bytecodeHash: "none" },
      optimizer: { enabled: true, runs: 800 },
      viaIR: true,
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
