import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const ASSET = "0x0000000000000000000000000000000000003aD2"; // WHBAR
const HOUR = 3600;

describe("Oracle adapters", function () {
  describe("ChainlinkOracleAdapter", function () {
    async function deployFixture(decimals = 8) {
      const [owner, alice] = await ethers.getSigners();
      const feed = await ethers.deployContract("MockChainlinkAggregator", [decimals]);
      const adapter = await ethers.deployContract("ChainlinkOracleAdapter", [owner.address]);
      await adapter.setFeed(ASSET, await feed.getAddress(), HOUR);
      return { adapter, feed, alice };
    }

    it("normalises an 8-decimal answer to 18 decimals", async function () {
      const { adapter, feed } = await deployFixture(8);
      const now = await time.latest();
      await feed.setRound(12_345_678n, now); // $0.12345678
      expect(await adapter.getPrice(ASSET)).to.deep.equal([ethers.parseUnits("0.12345678", 18), BigInt(now)]);
    });

    it("scales down feeds with more than 18 decimals", async function () {
      const { adapter, feed } = await deployFixture(20);
      await feed.setRound(ethers.parseUnits("2", 20), await time.latest());
      const [price] = await adapter.getPrice(ASSET);
      expect(price).to.equal(ethers.parseUnits("2", 18));
    });

    it("reverts on a stale answer", async function () {
      const { adapter, feed } = await deployFixture();
      const updatedAt = (await time.latest()) - HOUR - 1;
      await feed.setRound(1n, updatedAt);
      await expect(adapter.getPrice(ASSET))
        .to.be.revertedWithCustomError(adapter, "StalePrice")
        .withArgs(ASSET, updatedAt);
    });

    it("reverts on zero or negative answers", async function () {
      const { adapter, feed } = await deployFixture();
      for (const answer of [0n, -1n]) {
        await feed.setRound(answer, await time.latest());
        await expect(adapter.getPrice(ASSET)).to.be.revertedWithCustomError(adapter, "InvalidPrice");
      }
    });

    it("reverts for an asset without a feed", async function () {
      const { adapter } = await deployFixture();
      await expect(adapter.getPrice(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(adapter, "NoFeed")
        .withArgs(ethers.ZeroAddress);
    });

    it("only lets the owner set feeds", async function () {
      const { adapter, alice } = await deployFixture();
      await expect(adapter.connect(alice).setFeed(ASSET, alice.address, HOUR)).to.be.revertedWithCustomError(
        adapter,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("PythOracleAdapter", function () {
    const PRICE_ID = ethers.id("HBAR/USD");

    async function deployFixture() {
      const [owner, alice] = await ethers.getSigners();
      const pyth = await ethers.deployContract("MockPyth");
      const adapter = await ethers.deployContract("PythOracleAdapter", [owner.address, await pyth.getAddress()]);
      await adapter.setFeed(ASSET, PRICE_ID, HOUR);
      return { adapter, pyth, alice };
    }

    it("normalises price * 10^expo to 18 decimals", async function () {
      const { adapter, pyth } = await deployFixture();
      const now = await time.latest();
      await pyth.setPrice(PRICE_ID, 8_512_345n, -8, now); // $0.08512345
      expect(await adapter.getPrice(ASSET)).to.deep.equal([ethers.parseUnits("0.08512345", 18), BigInt(now)]);
    });

    it("reverts on a stale publish time", async function () {
      const { adapter, pyth } = await deployFixture();
      const publishTime = (await time.latest()) - HOUR - 1;
      await pyth.setPrice(PRICE_ID, 1n, -8, publishTime);
      await expect(adapter.getPrice(ASSET))
        .to.be.revertedWithCustomError(adapter, "StalePrice")
        .withArgs(ASSET, publishTime);
    });

    it("reverts on non-positive prices and positive exponents", async function () {
      const { adapter, pyth } = await deployFixture();
      const now = await time.latest();
      for (const [price, expo] of [
        [0n, -8],
        [-5n, -8],
        [5n, 1],
      ] as const) {
        await pyth.setPrice(PRICE_ID, price, expo, now);
        await expect(adapter.getPrice(ASSET)).to.be.revertedWithCustomError(adapter, "InvalidPrice");
      }
    });

    it("reverts for an asset without a feed", async function () {
      const { adapter } = await deployFixture();
      await expect(adapter.getPrice(ethers.ZeroAddress)).to.be.revertedWithCustomError(adapter, "NoFeed");
    });

    it("only lets the owner set feeds", async function () {
      const { adapter, alice } = await deployFixture();
      await expect(adapter.connect(alice).setFeed(ASSET, PRICE_ID, HOUR)).to.be.revertedWithCustomError(
        adapter,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("MockOracleAdapter", function () {
    it("returns the price set by the owner", async function () {
      const [owner] = await ethers.getSigners();
      const adapter = await ethers.deployContract("MockOracleAdapter", [owner.address]);
      await adapter.setPrice(ASSET, ethers.parseUnits("0.1", 18));
      const [price, updatedAt] = await adapter.getPrice(ASSET);
      expect(price).to.equal(ethers.parseUnits("0.1", 18));
      expect(updatedAt).to.equal(await time.latest());
    });

    it("reverts for an unset asset and for non-owners", async function () {
      const [owner, alice] = await ethers.getSigners();
      const adapter = await ethers.deployContract("MockOracleAdapter", [owner.address]);
      await expect(adapter.getPrice(ASSET)).to.be.revertedWithCustomError(adapter, "NoFeed");
      await expect(adapter.connect(alice).setPrice(ASSET, 1n)).to.be.revertedWithCustomError(
        adapter,
        "OwnableUnauthorizedAccount",
      );
    });
  });
});
