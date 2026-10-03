import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { BONZO_TESTNET } from "../utils/bonzo";
import { getDeployGasPrice } from "../utils/getDeployGasPrice";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/** Deploys BonzoFlashLoan on the SaucerSwap adapter and associates it with WHBAR and USDC. Testnet only. */
const deployFlashLoan: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, get, log } = hre.deployments;
  const gasPrice = await getDeployGasPrice(hre);

  const result = await deploy("BonzoFlashLoan", {
    from: deployer,
    args: [deployer, BONZO_TESTNET.lendingPool, (await get("SaucerSwapAdapter")).address],
    log: true,
    autoMine: true,
    gasLimit: "3000000",
    gasPrice,
  });

  if (result.newlyDeployed) {
    for (const token of [SAUCERSWAP_TESTNET.whbar, SAUCERSWAP_TESTNET.usdc]) {
      await execute("BonzoFlashLoan", { from: deployer, gasLimit: "1000000", gasPrice }, "associate", token);
    }
  }
  log(`BonzoFlashLoan: https://hashscan.io/testnet/contract/${result.address}`);
};

deployFlashLoan.tags = ["flashloan"];
deployFlashLoan.dependencies = ["dex"];
// Bonzo, SaucerSwap and the HTS precompile only exist on Hedera.
deployFlashLoan.skip = async hre => hre.network.name !== "hederaTestnet";
export default deployFlashLoan;
