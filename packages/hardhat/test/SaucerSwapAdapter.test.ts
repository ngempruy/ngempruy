import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SaucerSwapAdapter", function () {
  async function deployFixture() {
    const [owner, alice, merchant] = await ethers.getSigners();
    const whbar = await ethers.deployContract("MockERC20", ["WHBAR", 8]);
    const usdc = await ethers.deployContract("MockERC20", ["USDC", 6]);
    const router = await ethers.deployContract("MockSaucerSwapRouter");
    const adapter = await ethers.deployContract("SaucerSwapAdapter", [owner.address, await router.getAddress()]);

    await usdc.mint(await router.getAddress(), 1_000_000n);
    await whbar.mint(alice.address, 1_000n);
    await whbar.connect(alice).approve(await adapter.getAddress(), 1_000n);

    const path = [await whbar.getAddress(), await usdc.getAddress()];
    const deadline = (await time.latest()) + 600;
    return { adapter, router, whbar, usdc, owner, alice, merchant, path, deadline };
  }

  it("quotes the last hop of the router's amounts", async function () {
    const { adapter, router, path } = await deployFixture();
    await router.setRateBps(20_000); // 1 in → 2 out per hop
    expect(await adapter.quote(100n, path)).to.equal(200n);
  });

  it("swaps the caller's tokens and pays `to`", async function () {
    const { adapter, router, whbar, usdc, alice, merchant, path, deadline } = await deployFixture();
    await router.setRateBps(20_000);

    await expect(adapter.connect(alice).swap(100n, 200n, path, merchant.address, deadline))
      .to.emit(adapter, "Swapped")
      .withArgs(alice.address, path[0], path[1], 100n, 200n, merchant.address);

    expect(await usdc.balanceOf(merchant.address)).to.equal(200n);
    expect(await whbar.balanceOf(alice.address)).to.equal(900n);
    expect(await whbar.balanceOf(await adapter.getAddress())).to.equal(0n);
  });

  it("reverts when the output is below minAmountOut", async function () {
    const { adapter, router, alice, merchant, path, deadline } = await deployFixture();
    await router.setRateBps(9_000);
    await expect(adapter.connect(alice).swap(100n, 91n, path, merchant.address, deadline))
      .to.be.revertedWithCustomError(adapter, "InsufficientOutput")
      .withArgs(90n, 91n);
  });

  it("reverts after the deadline", async function () {
    const { adapter, alice, merchant, path } = await deployFixture();
    const deadline = (await time.latest()) - 1;
    await expect(adapter.connect(alice).swap(100n, 0n, path, merchant.address, deadline))
      .to.be.revertedWithCustomError(adapter, "Expired")
      .withArgs(deadline);
  });

  it("rejects a zero amount and a path shorter than two tokens", async function () {
    const { adapter, alice, merchant, path, deadline } = await deployFixture();
    await expect(adapter.connect(alice).swap(0n, 0n, path, merchant.address, deadline)).to.be.revertedWithCustomError(
      adapter,
      "ZeroAmount",
    );
    await expect(
      adapter.connect(alice).swap(100n, 0n, [path[0]], merchant.address, deadline),
    ).to.be.revertedWithCustomError(adapter, "InvalidPath");
    await expect(adapter.quote(100n, [path[0]])).to.be.revertedWithCustomError(adapter, "InvalidPath");
  });

  it("only lets the owner associate tokens", async function () {
    const { adapter, alice, path } = await deployFixture();
    await expect(adapter.connect(alice).associate(path[0])).to.be.revertedWithCustomError(
      adapter,
      "OwnableUnauthorizedAccount",
    );
  });
});
