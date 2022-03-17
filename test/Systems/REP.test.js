// For all system tests, you need to test each action a policy or user can call to the system
// and make sure they have the intended side effects. You can group each call in a "describe"
// block that handles all the different cases of that call. Work directly with the docs to figure out how to test.
// Maybe write docs first? To map out the tests. And then write the code to run the tests?


const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS } = require("../utils.js");


describe("REP.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];
    this.faucet = this.signers[10];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.Reputation = await (await ethers.getContractFactory("Reputation")).deploy(this.Proxy.address);
    await this.Reputation.deployed();

    this.ReputationPolicy = await (await ethers.getContractFactory("ReputationPolicy")).deploy(this.Proxy.address);
    await this.ReputationPolicy.deployed();

    await this.Proxy.executeAction(0, this.Reputation.address);
    await this.Proxy.executeAction(2, this.ReputationPolicy.address);
  })

  it("initializes state", async function () {
    expect(await this.Reputation.walletOfId("0x0000")).to.equal(ZERO_ADDRESS);
    expect(await this.Reputation.getId(ZERO_ADDRESS)).to.equal("0x0000");
    expect(await this.Reputation.budgetOfId("0x0000")).to.equal(0);
    expect(await this.Reputation.scoreOfId("0x0000")).to.equal(0);
    expect(await this.Reputation.uniqueRepsOfId("0x0000")).to.equal(0);
    expect(await this.Reputation.totalGivenTo("0x0000", "0x0000")).to.equal(0);
  })

  it("has functions that can only be called by Proxy Policies", async function() {
    await expect(this.Reputation.connect(this.user).registerWallet(this.user.address))
      .be.revertedWith("onlyPolicy(): only approved policies can call this function");
      
    await expect(this.Reputation.connect(this.user).increaseBudget("0x0000", 1000))
      .be.revertedWith("onlyPolicy(): only approved policies can call this function");

    await expect(this.Reputation.connect(this.user).transferReputation("0x0000", "0x0000", 1000))
      .be.revertedWith("onlyPolicy(): only approved policies can call this function");
  })

  describe("registerWallet()", async function () {
    it("emits the 'WalletRegistered' event", async function () {
      await expect(this.ReputationPolicy.registerWallet(this.user.address))
        .to.emit(this.Reputation, 'WalletRegistered')
        .withArgs(this.user.address, "0x7ceb");
    })

    it("throws an error if the address already has an ID", async function() {
      await this.ReputationPolicy.registerWallet(this.user.address);    
      await expect(this.ReputationPolicy.registerWallet(this.user.address)).to.be.revertedWith("cannot registerWallet(): wallet already registered");
    })

    it("saves a unique bytes2 Id for a given wallet", async function() {
      await this.ReputationPolicy.registerWallet(this.user.address);
      expect(await this.Reputation.getId(this.user.address)).to.equal("0x7ceb");
      expect(await this.Reputation.walletOfId("0x7ceb")).to.equal(this.user.address);
    })
  })  

  describe("increaseBudget()", async function () {
    before(async function () {
      this.memberId = await this.Reputation.getId(this.user.address);
      expect(this.memberId).to.not.equal(0);
      expect(await this.Reputation.budgetOfId(this.memberId)).to.equal(0);
    })

    it("emits the 'BudgetIncreased' event", async function () {
      await this.ReputationPolicy.registerWallet(this.user.address);

      await expect(this.ReputationPolicy.increaseBudget("0x7ceb", 100))
        .to.emit(this.Reputation, 'BudgetIncreased')
        .withArgs("0x7ceb", 100);
    })

    it("increases the reputation budget of an address", async function() {
      await this.ReputationPolicy.registerWallet(this.user.address);

      await this.ReputationPolicy.increaseBudget(this.memberId, 100);
      expect(await this.Reputation.budgetOfId(this.memberId)).to.equal(100);
    })
  })

  describe("transferReputation()", function() {

    beforeEach(async function() {
      await this.ReputationPolicy.registerWallet(this.dev.address);
      this.devId = await this.Reputation.getId(this.dev.address);

      await this.ReputationPolicy.registerWallet(this.user.address);
      this.userId = await this.Reputation.getId(this.user.address);

    })

    it("emits the 'ReputationTransferred' event", async function() {
      await this.ReputationPolicy.increaseBudget(this.devId, 100);
      await expect(this.ReputationPolicy.transferReputation(this.devId, this.userId, 2))
        .to.emit(this.Reputation, 'ReputationTransferred')
        .withArgs(this.devId, this.userId, 2);
    })

    it("throws an underflow error if the user doesn't have enough repBudget to give reputation", async function() {
      await this.ReputationPolicy.increaseBudget(this.devId, 10);
      await expect(this.ReputationPolicy.transferReputation(this.devId, this.userId, 11)).to.be.revertedWith("0x11");
    })

    it("increases the target Id's reputation score and decreases the origin Id's repBudget", async function() {
      await this.ReputationPolicy.increaseBudget(this.devId, 100);
      await this.ReputationPolicy.transferReputation(this.devId, this.userId, 2);
      expect(await this.Reputation.scoreOfId(this.userId)).to.equal(2);
      expect(await this.Reputation.budgetOfId(this.devId)).to.equal(98);

    })
  })

  describe("transferReputation()", function() {
    beforeEach(async function() {
      await this.ReputationPolicy.registerWallet(this.dev.address);
      this.devId = await this.Reputation.getId(this.dev.address);
      await this.ReputationPolicy.increaseBudget(this.devId, 100);

      await this.ReputationPolicy.registerWallet(this.user.address);
      this.userId = await this.Reputation.getId(this.user.address);

      await this.ReputationPolicy.transferReputation(this.devId, this.userId, 70);
    })

    it("reverts if the user does not have enough rep Budget to transfer", async function () {
      await expect(this.ReputationPolicy.transferReputation(this.devId, this.userId, 31))
        .to.be.revertedWith("0x11");
    })

    it("decreases the reputation budget of the giver", async function () {
      expect(await this.Reputation.budgetOfId(this.devId)).to.equal(30);
    })

    it("increases the reputation score of the receier", async function () {
      expect(await this.Reputation.scoreOfId(this.userId)).to.equal(70);
    })
  })
});
