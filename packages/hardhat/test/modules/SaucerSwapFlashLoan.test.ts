import { expect } from "chai";
import { ethers } from "hardhat";

const LOAN = 997_000n;
const FEE = (LOAN * 1000n) / 997n + 1n - LOAN; // 3001: Uniswap V2 0.3%, rounded up

describe("SaucerSwapFlashLoan", function () {
  async function deployFixture() {
    const [owner, alice] = await ethers.getSigners();
    const usdc = await ethers.deployContract("MockERC20", ["USDC", 6]);
    const whbar = await ethers.deployContract("MockERC20", ["WHBAR", 8]);
    const sauce = await ethers.deployContract("MockERC20", ["SAUCE", 6]);
    const [u, w, s] = [await usdc.getAddress(), await whbar.getAddress(), await sauce.getAddress()];

    const pair = await ethers.deployContract("MockSaucerSwapPair", [u, w]); // token0 = USDC, token1 = WHBAR
    const adapter = await ethers.deployContract("MockSwapAdapter");
    const flash = await ethers.deployContract("SaucerSwapFlashLoan", [
      owner.address,
      await adapter.getAddress(),
      ethers.ZeroAddress, // no liquidation venue needed for arbitrage
    ]);
    await flash.setFlashPair(w, await pair.getAddress());

    for (const token of [usdc, whbar, sauce]) {
      await token.mint(await pair.getAddress(), 10n * LOAN);
      await token.mint(await adapter.getAddress(), 10n * LOAN);
    }
    return { owner, alice, whbar, pair, adapter, flash, u, w, s };
  }

  it("borrows token1 from the pair, repays it with the 0.3% fee and keeps the profit", async function () {
    const { owner, whbar, pair, adapter, flash, w, s } = await deployFixture();
    await adapter.setRate(w, s, 10_000);
    await adapter.setRate(s, w, 10_100); // +1% through a different pair
    const profit = LOAN / 100n - FEE;

    await expect(flash.flashArbitrage(w, LOAN, [w, s], [s, w], profit))
      .to.emit(flash, "FlashLoanExecuted")
      .withArgs(0, w, LOAN, FEE, profit);

    expect(await whbar.balanceOf(owner.address)).to.equal(profit);
    expect(await whbar.balanceOf(await pair.getAddress())).to.equal(10n * LOAN + FEE);
  });

  it("borrows token0 as well", async function () {
    const { pair, adapter, flash, u, s } = await deployFixture();
    await flash.setFlashPair(u, await pair.getAddress());
    await adapter.setRate(u, s, 10_000);
    await adapter.setRate(s, u, 10_100);

    await expect(flash.flashArbitrage(u, LOAN, [u, s], [s, u], 0))
      .to.emit(flash, "FlashLoanExecuted")
      .withArgs(0, u, LOAN, FEE, LOAN / 100n - FEE);
  });

  it("covers a loss from the owner up to -minPnl", async function () {
    const { owner, whbar, adapter, flash, w, s } = await deployFixture();
    await adapter.setRate(w, s, 10_000);
    await adapter.setRate(s, w, 10_000);
    await whbar.mint(owner.address, FEE);
    await whbar.approve(await flash.getAddress(), FEE);

    await expect(flash.flashArbitrage(w, LOAN, [w, s], [s, w], -FEE))
      .to.emit(flash, "FlashLoanExecuted")
      .withArgs(0, w, LOAN, FEE, -FEE);
    await expect(flash.flashArbitrage(w, LOAN, [w, s], [s, w], -FEE + 1n))
      .to.be.revertedWithCustomError(flash, "PnlBelowMinimum")
      .withArgs(-FEE, -FEE + 1n);
  });

  it("reverts for an asset without a flash pair", async function () {
    const { flash, s } = await deployFixture();
    await expect(flash.flashArbitrage(s, LOAN, [s], [s], 0))
      .to.be.revertedWithCustomError(flash, "NoFlashPair")
      .withArgs(s);
  });

  it("rejects callbacks outside its own flash swap", async function () {
    const { alice, pair, flash } = await deployFixture();
    await expect(flash.connect(alice).uniswapV2Call(alice.address, 1n, 0n, "0x")).to.be.revertedWithCustomError(
      flash,
      "NotActivePair",
    );
    // Someone else flash-swapping from the pair *to* this contract.
    await expect(pair.connect(alice).swap(0n, 1n, await flash.getAddress(), "0x01")).to.be.revertedWithCustomError(
      flash,
      "NotActivePair",
    );
  });

  it("only lets the owner configure pairs and start loans", async function () {
    const { alice, pair, flash, w, s } = await deployFixture();
    await expect(flash.connect(alice).setFlashPair(w, await pair.getAddress())).to.be.revertedWithCustomError(
      flash,
      "OwnableUnauthorizedAccount",
    );
    await expect(flash.connect(alice).flashArbitrage(w, LOAN, [w, s], [s, w], 0)).to.be.revertedWithCustomError(
      flash,
      "OwnableUnauthorizedAccount",
    );
  });
});
