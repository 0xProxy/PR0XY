// For all system tests, you need to test each action a policy or user can call to the system
// and make sure they have the intended side effects. You can group each call in a "describe"
// block that handles all the different cases of that call. Work directly with the docs to figure out how to test.
// Maybe write docs first? To map out the tests. And then write the code to run the tests?


const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber} = require("ethers");
const { ZERO_ADDRESS } = require("../utils.js");
const { getOpcodeLength } = require("hardhat/internal/hardhat-network/stack-traces/opcodes");


describe("VTP.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.VotingPower = await (await ethers.getContractFactory("VotingPower")).deploy(this.Proxy.address);
    await this.VotingPower.deployed();

    this.VotingPowerPolicy = await (await ethers.getContractFactory("VotingPowerPolicy")).deploy(this.Proxy.address);
    await this.VotingPowerPolicy.deployed();

    await this.Proxy.executeAction(0, this.VotingPower.address);
    await this.Proxy.executeAction(2, this.VotingPowerPolicy.address);
  })

  it("initializes state", async function () {
    expect(await this.VotingPower.name()).to.equal("PROXY Voting Power");
    expect(await this.VotingPower.symbol()).to.equal("gPROX");
    expect(await this.VotingPower.decimals()).to.equal(3);

    expect(await this.VotingPower.balanceOf(this.dev.address)).to.equal(0);
    expect(await this.VotingPower.totalSupply()).to.equal(0);

    expect(await this.VotingPower.allowance(this.dev.address, this.user.address)).to.equal( BigNumber.from(2).pow(256).sub(1) ); // (2**256) - 1, or MAX
    expect(await this.VotingPower.approve(this.user.address, 1000)).to.equal(true);
    
    expect(await this.VotingPower.vestingCreditsOf(this.dev.address)).to.equal(0);
  })

  it("has functions that can only be called by Proxy Policies", async function() {
    await expect(this.VotingPower.connect(this.user).issue(this.user.address, 1000)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.VotingPower.connect(this.user).redeem(this.user.address, 0)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.VotingPower.connect(this.user).rebase(0)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.VotingPower.connect(this.user).incrementVestingCredits(this.user.address)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.VotingPower.connect(this.user).resetVestingCredits(this.user.address)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
  })

  describe("transfer()", async function () {
    it ("is properly disabled", async function () {
      await expect(this.VotingPower.transfer(this.user.address, 3000))
      .to.be.revertedWith("0x1")
    })
  })

  describe("transferFrom()", async function () {
    it("is properly disabled", async function () {
      await expect(this.VotingPower.transferFrom(this.dev.address, this.user.address, 3000))
        .to.be.revertedWith("0x1")
    })
  })

  describe("rebase()", async function () {
    beforeEach(async function() {
      await this.VotingPowerPolicy.issue(this.dev.address, 10000);
      await this.VotingPowerPolicy.rebase(500);
    })

    it("emits the 'Rebased' event", async function () {
      await expect(this.VotingPowerPolicy.rebase(500))
        .to.emit(this.VotingPower, 'Rebased')
        .withArgs(500);
    })

    it("increases the index", async function () {
      expect(await this.VotingPower.currentIndex()).to.equal(1050000);
      for (i = 0; i < 500; i++) {
        let randomRebase = Math.floor(Math.random() * 1000);
        let currentIndex = await this.VotingPower.currentIndex();
        
        // console.log("I: ", i);
        // console.log("randomRebase: ", randomRebase);
        // console.log("currentIndex: ", currentIndex);

        await this.VotingPowerPolicy.rebase(randomRebase);
        expect (await this.VotingPower.currentIndex()).to.equal( BigNumber.from(currentIndex).mul(10000 + randomRebase).div(10000 ));
      }
    })
    
    it("scales the balance of an address", async function () {
      expect(await this.VotingPower.balanceOf(this.dev.address)).to.equal(10500);
    })

    it("scales the total supply", async function () {
      expect(await this.VotingPower.totalSupply()).to.equal(10500);
    })
  })

  describe("issue()", async function () {
    it("emits the 'Transfer' event", async function () {
      await expect(this.VotingPowerPolicy.issue(this.dev.address, 1337))
        .to.emit(this.VotingPower, 'Transfer')
        .withArgs(ZERO_ADDRESS, this.dev.address, 1337);
    })

    it ("issues the base amount and returns the base value", async function () {
      await this.VotingPowerPolicy.rebase(513);
      
      await this.VotingPowerPolicy.issue(this.dev.address, 10000);
      await this.VotingPowerPolicy.issue(this.user.address, 5777);

      let baseAmt = BigNumber.from(10000).mul(1000000).div(1051300);
      expect(await this.VotingPower.balanceOf(this.dev.address)).to.equal(BigNumber.from(baseAmt).mul(1051300).div(1000000));

      baseAmt = BigNumber.from(5777).mul(1000000).div(1051300);
      expect(await this.VotingPower.balanceOf(this.user.address)).to.equal(BigNumber.from(baseAmt).mul(1051300).div(1000000));

      baseAmt = BigNumber.from(15777).mul(1000000).div(1051300);
      expect(await this.VotingPower.totalSupply()).to.equal(BigNumber.from(baseAmt).mul(1051300).div(1000000));
    })
  })

  describe("redeem()", async function () {
    beforeEach(async function () {
      await this.VotingPowerPolicy.issue(this.dev.address, 10000);
    })

    it("emits the 'Transfer' event", async function () {
      await expect(this.VotingPowerPolicy.redeem(this.dev.address, 10000))
        .to.emit(this.VotingPower, 'Transfer')
        .withArgs(this.dev.address, ZERO_ADDRESS, 10000);
    })

    it("adjusts the baseBalance", async function () {
      await this.VotingPowerPolicy.rebase(777);
      
      await this.VotingPowerPolicy.redeem(this.dev.address, 10000);
      expect(await this.VotingPower.balanceOf(this.dev.address)).to.equal(777);
    })
  }) 

  describe("incrementVestingCredits()", async function () {
    it("emits the 'VestingCreditsIncremented' event", async function () {
      await expect(this.VotingPowerPolicy.incrementVestingCredits(this.dev.address))
        .to.emit(this.VotingPower, 'VestingCreditsIncremented')
        .withArgs(this.dev.address);
    })

    it("increments the vesting credit", async function () {
      await this.VotingPowerPolicy.incrementVestingCredits(this.dev.address);
      expect(await this.VotingPower.vestingCreditsOf(this.dev.address)).to.equal(1);

      await this.VotingPowerPolicy.incrementVestingCredits(this.dev.address);
      expect(await this.VotingPower.vestingCreditsOf(this.dev.address)).to.equal(2);
    })
  })

  describe("resetVestingCredits()", async function () {
    it("emits the 'VestingCreditsReset' event", async function () {
      await expect(this.VotingPowerPolicy.resetVestingCredits(this.dev.address))
        .to.emit(this.VotingPower, 'VestingCreditsReset')
        .withArgs(this.dev.address);
    })

    it("resets the vesting credits to 0", async function () {
      await this.VotingPowerPolicy.incrementVestingCredits(this.dev.address);
      await this.VotingPowerPolicy.incrementVestingCredits(this.dev.address);
      expect(await this.VotingPower.vestingCreditsOf(this.dev.address)).to.equal(2);

      await this.VotingPowerPolicy.resetVestingCredits(this.dev.address);
      expect(await this.VotingPower.vestingCreditsOf(this.dev.address)).to.equal(0);
    })
  })
});
