import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployGasPrice } from "../utils/getDeployGasPrice";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/** Deploys the SaucerSwap ISwapAdapter and associates it with WHBAR and USDC. Testnet only. */
const deploySaucerSwapAdapter: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, log } = hre.deployments;
  const gasPrice = await getDeployGasPrice(hre);

  const result = await deploy("SaucerSwapAdapter", {
    from: deployer,
    args: [deployer, SAUCERSWAP_TESTNET.router],
    log: true,
    autoMine: true,
    gasLimit: "3000000",
    gasPrice,
  });

  if (result.newlyDeployed) {
    for (const token of [SAUCERSWAP_TESTNET.whbar, SAUCERSWAP_TESTNET.usdc]) {
      await execute("SaucerSwapAdapter", { from: deployer, gasLimit: "1000000", gasPrice }, "associate", token);
    }
  }
  log(`SaucerSwapAdapter: https://hashscan.io/testnet/contract/${result.address}`);
};

deploySaucerSwapAdapter.tags = ["dex"];
// SaucerSwap and the HTS precompile only exist on Hedera.
deploySaucerSwapAdapter.skip = async hre => hre.network.name !== "hederaTestnet";
export default deploySaucerSwapAdapter;
