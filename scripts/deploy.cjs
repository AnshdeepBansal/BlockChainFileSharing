const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
