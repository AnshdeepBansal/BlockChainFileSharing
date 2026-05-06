const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const ALLOWED_CHAIN_IDS = [31337, 11155111];

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (!ALLOWED_CHAIN_IDS.includes(chainId)) {
    throw new Error(
      `Unsafe deployment target chainId=${chainId}. Allowed: ${ALLOWED_CHAIN_IDS.join(", ")}`
    );
  }

  console.log(`Deploying on network=${network.name} chainId=${chainId}`);
  console.log("Deploying FileAccessControl...");

  const FileAccessControl = await hre.ethers.getContractFactory("FileAccessControl");
  const contract = await FileAccessControl.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`FileAccessControl deployed to: ${address}`);

  // Write the deployed address to a JSON file so the frontend can import it
  const deploymentPath = path.join(__dirname, "..", "src", "lib", "deployedAddress.json");
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify({ address }, null, 2)
  );
  console.log(`Deployment address written to ${deploymentPath}`);

  // Also update .env.local so Next.js picks it up at runtime
  const envPath = path.join(__dirname, "..", ".env.local");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
    // Remove old CONTRACT_ADDRESS line if present
    envContent = envContent.replace(/^NEXT_PUBLIC_CONTRACT_ADDRESS=.*\n?/m, "");
  }
  envContent += `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log(`Contract address written to .env.local`);

  const deploymentLogPath = path.join(__dirname, "..", "cache", "deployments.json");
  let logs = [];
  if (fs.existsSync(deploymentLogPath)) {
    logs = JSON.parse(fs.readFileSync(deploymentLogPath, "utf8"));
  }
  logs.push({
    contract: "FileAccessControl",
    address,
    chainId,
    network: network.name,
    deployedAt: new Date().toISOString(),
  });
  fs.writeFileSync(deploymentLogPath, JSON.stringify(logs, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
