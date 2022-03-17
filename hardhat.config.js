// dependencies

require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
    {
      version: '0.8.11',
      settings: {
        optimizer: {
          enabled: true,
          runs: 9999,
        }
      }
    }]
  },
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      default: 0,
      polygonMainnet: '0xca88A4b589bD76361517f20985365DE9c2376139'
    }
  },
  networks: {
    dev: {
      url: "http://0.0.0.0:8545",
    },
    hardhat: {
      accounts: {
        count: 100 
      },
      // forking: {
      //   url: "https://eth-mainnet.alchemyapi.io/v2/tZGJbZSkR3LAZLLaRoYw21uG1j1codpt",
      //   blockNumber: 14143618
      // }
    },
    ropsten: {
      url: "https://ropsten.infura.io/v3/cb3b2911315442f68e6d83936c5b46dd",
      accounts: [process.env.PRIVATE_KEY],
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.PRIVATE_KEY],
    },
    polygonMainnet: {
      url: "https://polygon-mainnet.g.alchemy.com/v2/lP6lP_6hE-DN59hifFzJbMOM8vnZP7-g",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    },
    avalancheMainnet: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.SNOWTRACE_API_KEY,
    }
  },
};
