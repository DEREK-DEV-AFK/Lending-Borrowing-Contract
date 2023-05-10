require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.11",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${process.env.goerliApiKey}`,
      accounts: [process.env.PRIVATE_KEY2]
    },
    // hardhat: {
    //   forking: {
    //     // url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.poygonApiKey}`,
    //     // url: `https://eth-goerli.g.alchemy.com/v2/${process.env.goerliApiKey}`,
    //     // blockNumber: 8894170,
    //     url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.mainnetApiKey}`,
    //     blockNumber: 17129400, // 
    //     // 15226243 - at WBTC price low
    //   }
    // },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.ETHERSCAN_MUMBAI_API_KEY,
      goerli: process.env.ETHERSCAN_GOERLI_API_KEY
    }
  },
  mocha: {
    timeout: 60000
  } 
};
