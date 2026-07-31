import { ethers } from "hardhat";
import { expect } from "chai";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const UNIT = 10n ** 6n;

describe("MockYield4626", function () {
  async function deploy() {
    const [owner, alice] = await ethers.getSigners();
    const MockZama = await ethers.getContractFactory("MockZama");
    const asset = await MockZama.deploy();
    await asset.waitForDeployment();

    const MockYield4626 = await ethers.getContractFactory("MockYield4626");
    const vault = await MockYield4626.deploy(
      await asset.getAddress(),
      "Mock Yield USDC",
      "myUSDC",
      owner.address,
      500,
    );
    await vault.waitForDeployment();

    const mintAmount = 1_000n * UNIT;
    await (await asset.mint(alice.address, mintAmount)).wait();
    await (await asset.connect(alice).approve(await vault.getAddress(), mintAmount)).wait();

    return { owner, alice, asset, vault, mintAmount };
  }

  it("raises share price when yield is accrued", async function () {
    const { alice, asset, vault, owner } = await deploy();
    const deposit = 100n * UNIT;
    await (await vault.connect(alice).deposit(deposit, alice.address)).wait();

    const sharesBefore = await vault.balanceOf(alice.address);
    const assetsBefore = await vault.convertToAssets(sharesBefore);

    const yieldAmt = 5n * UNIT;
    await (await asset.mint(owner.address, yieldAmt)).wait();
    await (await asset.connect(owner).approve(await vault.getAddress(), yieldAmt)).wait();
    await (await vault.connect(owner).accrue(yieldAmt)).wait();

    const assetsAfter = await vault.convertToAssets(sharesBefore);
    expect(assetsAfter).to.be.closeTo(assetsBefore + yieldAmt, 2n);
  });

  it("accrues time-based yield from the funder", async function () {
    const { alice, asset, vault, owner } = await deploy();
    const deposit = 365n * UNIT;
    await (await vault.connect(alice).deposit(deposit, alice.address)).wait();

    await time.increase(365 * 24 * 60 * 60);

    const expected = (deposit * 500n) / 10_000n;
    await (await asset.mint(owner.address, expected + UNIT)).wait();
    await (
      await asset.connect(owner).approve(await vault.getAddress(), expected + UNIT)
    ).wait();

    const before = await vault.totalAssets();
    await (await vault.connect(owner).accrueElapsed()).wait();
    const after = await vault.totalAssets();
    expect(after).to.be.gt(before);
  });
});
