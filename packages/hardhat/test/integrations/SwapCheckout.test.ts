import { expect } from "chai";
import { ethers } from "hardhat";

const ORDER = ethers.id("order-42");
const PRICE = 1_000_000n; // 1 USDC

describe("SwapCheckout", function () {
  async function deployFixture() {
    const [payer, merchant] = await ethers.getSigners();
    const usdc = await ethers.deployContract("MockERC20", ["USDC", 6]);
    const whbar = await ethers.deployContract("MockERC20", ["WHBAR", 8]);
    const adapter = await ethers.deployContract("MockSwapAdapter");
    const checkout = await ethers.deployContract("SwapCheckout", [await adapter.getAddress(), await usdc.getAddress()]);
    const [u, w, c] = [await usdc.getAddress(), await whbar.getAddress(), await checkout.getAddress()];

    await usdc.mint(await adapter.getAddress(), 100n * PRICE);
    await whbar.mint(payer.address, 100n * PRICE);
    await usdc.mint(payer.address, 10n * PRICE);
    await whbar.approve(c, ethers.MaxUint256);
    await usdc.approve(c, ethers.MaxUint256);
    await adapter.setRate(w, u, 5_000); // 1 WHBAR unit → 0.5 USDC unit
    return { payer, merchant, usdc, whbar, adapter, checkout, u, w };
  }

  it("swaps the payer's token, pays the merchant the exact price and refunds the surplus", async function () {
    const { payer, merchant, usdc, whbar, checkout, u, w } = await deployFixture();
    const amountIn = 2_100_000n; // → 1.05 USDC
    const refund = amountIn / 2n - PRICE;
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 600;

    await expect(checkout.pay(ORDER, merchant.address, PRICE, [w, u], amountIn, deadline))
      .to.emit(checkout, "Paid")
      .withArgs(ORDER, payer.address, merchant.address, w, amountIn, PRICE, refund);

    expect(await usdc.balanceOf(merchant.address)).to.equal(PRICE);
    expect(await usdc.balanceOf(payer.address)).to.equal(10n * PRICE + refund);
    expect(await whbar.balanceOf(payer.address)).to.equal(100n * PRICE - amountIn);
    expect(await usdc.balanceOf(await checkout.getAddress())).to.equal(0n);
  });

  it("reverts when the swap yields less than the price", async function () {
    const { merchant, checkout, u, w } = await deployFixture();
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 600;
    // MockSwapAdapter enforces minAmountOut like the real adapter
    await expect(checkout.pay(ORDER, merchant.address, PRICE, [w, u], 1_999_998n, deadline)).to.be.revertedWith(
      "slippage",
    );
  });

  it("transfers USDC straight to the merchant when the payer already holds USDC", async function () {
    const { payer, merchant, usdc, checkout, u } = await deployFixture();
    await expect(checkout.pay(ORDER, merchant.address, PRICE, [u], 0, 0))
      .to.emit(checkout, "Paid")
      .withArgs(ORDER, payer.address, merchant.address, u, PRICE, PRICE, 0);
    expect(await usdc.balanceOf(merchant.address)).to.equal(PRICE);
  });

  it("rejects a zero price and a path that does not end in USDC", async function () {
    const { merchant, checkout, w } = await deployFixture();
    await expect(checkout.pay(ORDER, merchant.address, 0, [w], 1, 0)).to.be.revertedWithCustomError(
      checkout,
      "ZeroPrice",
    );
    await expect(checkout.pay(ORDER, merchant.address, PRICE, [w], 1, 0)).to.be.revertedWithCustomError(
      checkout,
      "PathMustEndInUsdc",
    );
    await expect(checkout.pay(ORDER, merchant.address, PRICE, [], 1, 0)).to.be.revertedWithCustomError(
      checkout,
      "PathMustEndInUsdc",
    );
  });
});
