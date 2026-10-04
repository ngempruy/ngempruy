import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployGasPrice } from "../utils/getDeployGasPrice";
import { LENDING_TESTNET } from "../utils/lending";

/** Chainlink HBAR/USD prices the WHBAR collateral; the testnet feed updates far less than hourly, so allow a day. */
const FEED_MAX_AGE = 86_400;
/** 50% max LTV, liquidation above 80%, a scheduled health check every hour. */
const RISK = { maxLtvBps: 5_000, liquidationThresholdBps: 8_000, checkInterval: 3_600 };
/** HBAR the market keeps to pay for its own scheduled checks (~1.7 HBAR each). */
const CHECK_BUDGET = "5";

/** Lending: WHBAR-collateralised USDC loans with HIP-1215 scheduled health checks. Testnet only. */
const deployLending: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers } = hre;
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, log } = hre.deployments;
  const gasPrice = await getDeployGasPrice(hre);
  const tx = { from: deployer, gasLimit: "1000000", gasPrice };
  const { whbar, usdc, chainlinkHbarUsd } = LENDING_TESTNET;

  const oracle = await deploy("ChainlinkOracleAdapter", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
    gasLimit: "2000000",
    gasPrice,
  });
  if (oracle.newlyDeployed) {
    await execute("ChainlinkOracleAdapter", tx, "setFeed", whbar, chainlinkHbarUsd, FEED_MAX_AGE);
  }

  const market = await deploy("LendingMarket", {
    from: deployer,
    args: [deployer, whbar, 8, usdc, oracle.address, RISK.maxLtvBps, RISK.liquidationThresholdBps, RISK.checkInterval],
    log: true,
    autoMine: true,
    gasLimit: "4000000",
    gasPrice,
  });
  if (market.newlyDeployed) {
    for (const token of [whbar, usdc]) await execute("LendingMarket", tx, "associate", token);
    const signer = await ethers.getSigner(deployer);
    await (await signer.sendTransaction({ to: market.address, value: ethers.parseEther(CHECK_BUDGET) })).wait();
  }
  log(`LendingMarket: https://hashscan.io/testnet/contract/${market.address}`);
};

deployLending.tags = ["lending"];
// HTS, the schedule service (0x16b) and the Chainlink feed only exist on Hedera.
deployLending.skip = async hre => hre.network.name !== "hederaTestnet";
export default deployLending;
