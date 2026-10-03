import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployGasPrice } from "../utils/getDeployGasPrice";
import { SAUCERSWAP_TESTNET } from "../utils/saucerswap";

/** Recipe dex+payments: SwapCheckout on the SaucerSwap adapter, settling in USDC. Testnet only. */
const deploySwapCheckout: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, get, log } = hre.deployments;
  const gasPrice = await getDeployGasPrice(hre);
  const { usdc, whbar, sauce } = SAUCERSWAP_TESTNET;

  const result = await deploy("SwapCheckout", {
    from: deployer,
    args: [(await get("SaucerSwapAdapter")).address, usdc],
    log: true,
    autoMine: true,
    gasLimit: "3000000",
    gasPrice,
  });
  if (result.newlyDeployed) {
    // USDC to settle, plus the tokens the UI and demo offer to pay with.
    for (const token of [usdc, whbar, sauce]) {
      await execute("SwapCheckout", { from: deployer, gasLimit: "1000000", gasPrice }, "associate", token);
    }
  }
  log(`SwapCheckout: https://hashscan.io/testnet/contract/${result.address}`);
};

deploySwapCheckout.tags = ["dex+payments"];
deploySwapCheckout.dependencies = ["dex"];
deploySwapCheckout.skip = async hre => hre.network.name !== "hederaTestnet";
export default deploySwapCheckout;
