import password from "@inquirer/password";
import { spawn } from "child_process";
import * as dotenv from "dotenv";
import { Wallet } from "ethers";
import { config } from "hardhat";

dotenv.config();

/**
 * Unencrypts the private key and runs the hardhat deploy command.
 * With `run <script>` as the first arguments it runs that script instead (`yarn script <path>`).
 * Non-interactive (CI, agents): a plain DEPLOYER_PRIVATE_KEY in the environment skips the password prompt.
 */
async function main() {
  const hardhatArgs = process.argv[2] === "run" ? process.argv.slice(2) : ["deploy", ...process.argv.slice(2)];

  const networkIndex = process.argv.indexOf("--network");
  const networkName = networkIndex !== -1 ? process.argv[networkIndex + 1] : config.defaultNetwork;

  if (networkName === "localhost" || networkName === "hardhat") {
    // Deploy command on the localhost network
    const hardhat = spawn("hardhat", hardhatArgs, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    hardhat.on("exit", code => {
      process.exit(code || 0);
    });
    return;
  }

  if (process.env.DEPLOYER_PRIVATE_KEY) {
    process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
    const hardhat = spawn("hardhat", hardhatArgs, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
    hardhat.on("exit", code => process.exit(code || 0));
    return;
  }

  const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;

  if (!encryptedKey) {
    console.log("🚫️ You don't have a deployer account. Run `yarn account:generate` or `yarn account:import` first");
    return;
  }

  const pass = await password({ message: "Enter password to decrypt private key:" });

  try {
    const wallet = await Wallet.fromEncryptedJson(encryptedKey, pass);
    process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY = wallet.privateKey;

    const hardhat = spawn("hardhat", hardhatArgs, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    hardhat.on("exit", code => {
      process.exit(code || 0);
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    console.error("Failed to decrypt private key. Wrong password?");
    process.exit(1);
  }
}

main().catch(console.error);
