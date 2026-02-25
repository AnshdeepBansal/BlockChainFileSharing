require("@nomicfoundation/hardhat-toolbox");

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: "0.8.20",
  paths: {
    sources: "./contracts",
    artifacts: "./src/artifacts",   // ABI lands inside src/ so Next.js can import it
    cache: "./cache",
    tests: "./test",
  },
  networks: {
    hardhat: {},                    // local in-memory chain
    localhost: {                    // persistent local node  (npx hardhat node)
      url: "http://127.0.0.1:8545",
    },
  },
};
