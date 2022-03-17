// For all system tests, you need to test each action a policy or user can call to the system
// and make sure they have the intended side effects. You can group each call in a "describe"
// block that handles all the different cases of that call. Work directly with the docs to figure out how to test.
// Maybe write docs first? To map out the tests. And then write the code to run the tests?

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber} = require("ethers");
const { ZERO_ADDRESS, getBigNumber } = require("../utils.js");


describe("TSY.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.Treasury = await (await ethers.getContractFactory("Treasury")).deploy(this.Proxy.address);
    await this.Treasury.deployed();

    this.TreasuryPolicy = await (await ethers.getContractFactory("TreasuryPolicy")).deploy(this.Proxy.address);
    await this.TreasuryPolicy.deployed();
 
    await this.Proxy.executeAction(0, this.Treasury.address);
    await this.Proxy.executeAction(2, this.TreasuryPolicy.address);

    this.SampleERC20 = await (await ethers.getContractFactory("ERC20PresetMinterPauser")).deploy("ERC20", "Token");
    await this.SampleERC20.deployed();
  })

  it("initializes state", async function () {
    expect(await this.Treasury.trackedAsset(this.SampleERC20.address)).to.equal(false);
    
    expect(await this.Treasury.totalInflowsForAsset(this.SampleERC20.address)).to.equal(0);
    expect(await this.Treasury.totalOutflowsForAsset(this.SampleERC20.address)).to.equal(0);

    expect(await this.Treasury.assetInflowsPerEpoch(0, this.SampleERC20.address)).to.equal(0);
    expect(await this.Treasury.assetOutflowsPerEpoch(0, this.SampleERC20.address)).to.equal(0);
  })

  it("has functions that can only be called by Proxy Policies", async function() {
    await expect(this.Treasury.connect(this.user).addTrackedAsset(this.SampleERC20.address)).to.be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.Treasury.connect(this.user).processPayment(this.dev.address, this.SampleERC20.address, 0)).to.be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.Treasury.connect(this.user).withdrawFunds(this.SampleERC20.address, 0)).to.be.revertedWith("onlyPolicy(): only approved policies can call this function");
  })

  describe("processPayment()", function() {
    beforeEach(async function () {
      await this.SampleERC20.mint(this.user.address, getBigNumber(100));
      expect(await this.SampleERC20.balanceOf(this.user.address)).to.equal(getBigNumber(100));
      await this.SampleERC20.connect(this.user).approve(this.Treasury.address, getBigNumber(100));
    })

    it("emits the 'PaymentProcessed' event", async function () {
      await this.TreasuryPolicy.addTrackedAsset(this.SampleERC20.address);
      await expect(this.TreasuryPolicy.processPayment(this.user.address, this.SampleERC20.address, 100))
        .to.emit(this.Treasury, 'PaymentProcessed')
        .withArgs(this.user.address, this.SampleERC20.address, 100);
    })

    it("only accepts currencies that are tracked by the treasury", async function () {
      await expect(this.TreasuryPolicy.processPayment(this.user.address, this.dev.address, 100))
        .to.be.revertedWith("cannot processPayment(): token is not an accepted currency by the treasury");
    })

    it("transfers the approved asset from the calling user", async function () {
      await this.TreasuryPolicy.addTrackedAsset(this.SampleERC20.address);
      await this.TreasuryPolicy.processPayment(this.user.address, this.SampleERC20.address, getBigNumber(60));

      expect(await this.SampleERC20.balanceOf(this.user.address)).to.equal(getBigNumber(40));
      expect(await this.SampleERC20.balanceOf(this.Treasury.address)).to.equal(getBigNumber(60));
    })

    it("updates the inflow state", async function () {
      await this.TreasuryPolicy.addTrackedAsset(this.SampleERC20.address);
      await this.TreasuryPolicy.processPayment(this.user.address, this.SampleERC20.address, getBigNumber(60));

      expect(await this.Treasury.totalInflowsForAsset(this.SampleERC20.address)).to.equal(getBigNumber(60));
      expect(await this.Treasury.assetInflowsPerEpoch(0, this.SampleERC20.address)).to.equal(getBigNumber(60));
    })
  })

  describe("withdrawFunds()", function() {
    beforeEach(async function () {
      await this.SampleERC20.mint(this.Treasury.address, getBigNumber(100));
      expect(await this.SampleERC20.balanceOf(this.Treasury.address)).to.equal(getBigNumber(100));
      expect(await this.SampleERC20.balanceOf(this.dev.address)).to.equal(0);
    })
    
    it("emits the 'FundsWithdrawn' event", async function () {
      await this.TreasuryPolicy.addTrackedAsset(this.SampleERC20.address);
      await expect(this.TreasuryPolicy.withdrawFunds(this.SampleERC20.address, getBigNumber(20)))
        .to.emit(this.Treasury, "FundsWithdrawn")
        .withArgs(this.SampleERC20.address, getBigNumber(20))
    })

    it("only accepts currencies that are tracked by the treasury", async function () {
      await expect(this.TreasuryPolicy.withdrawFunds(this.SampleERC20.address, 0))
        .to.be.revertedWith("cannot withdrawFunds(): token is not an accepted currency by the treasury");
    })

    it("transfers the approved asset to the calling policy", async function () {
      await this.TreasuryPolicy.addTrackedAsset(this.SampleERC20.address);
      await this.TreasuryPolicy.withdrawFunds(this.SampleERC20.address, getBigNumber(40));

      expect(await this.SampleERC20.balanceOf(this.TreasuryPolicy.address)).to.equal(getBigNumber(40));
      expect(await this.SampleERC20.balanceOf(this.Treasury.address)).to.equal(getBigNumber(60));
    })

    it("updates the outflow state", async function () {
      await this.TreasuryPolicy.addTrackedAsset(this.SampleERC20.address);
      await this.TreasuryPolicy.withdrawFunds(this.SampleERC20.address, getBigNumber(40));

      expect(await this.Treasury.totalOutflowsForAsset(this.SampleERC20.address)).to.equal(getBigNumber(40));
      expect(await this.Treasury.assetOutflowsPerEpoch(0, this.SampleERC20.address)).to.equal(getBigNumber(40));
    })
  })

});
