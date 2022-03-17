// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
  await this.Proxy.deployed();

  this.Reputation = await (await ethers.getContractFactory("Reputation")).deploy(this.Proxy.address);
  await this.Reputation.deployed();

  this.Token = await (await ethers.getContractFactory("Token")).deploy(this.Proxy.address);
  await this.Token.deployed();

  this.Executive = await (await ethers.getContractFactory("Executive")).deploy(this.Proxy.address);
  await this.Executive.deployed();

  this.Treasury = await (await ethers.getContractFactory("Treasury")).deploy(this.Proxy.address);
  await this.Treasury.deployed();

  this.VotingPower = await (await ethers.getContractFactory("VotingPower")).deploy(this.Proxy.address);
  await this.VotingPower.deployed();

  // Governance
  this.


  // Prelaunch

  //ProxyDAO

  //TokenSale



  // const ProxyFactory = await hre.ethers.getContractFactory("Proxy");
  // const Proxy = await ProxyFactory.deploy();

  // await Proxy.deployed();

  // console.log("Proxy deployed to:", Proxy.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
