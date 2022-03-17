// For all system tests, you need to test each action a policy or user can call to the system
// and make sure they have the intended side effects. You can group each call in a "describe"
// block that handles all the different cases of that call. Work directly with the docs to figure out how to test.
// Maybe write docs first? To map out the tests. And then write the code to run the tests?


const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, systemKeycode } = require("../utils.js");


describe("EXC.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.Executive = await (await ethers.getContractFactory("Executive")).deploy(this.Proxy.address);
    await this.Executive.deployed();

    this.SampleSystem = await (await ethers.getContractFactory("Token")).deploy(this.Proxy.address);
    await this.SampleSystem.deployed();

    this.ExecutivePolicy = await (await ethers.getContractFactory("ExecutivePolicy")).deploy(this.Proxy.address);
    await this.ExecutivePolicy.deployed();

    this.SamplePolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
    await this.SamplePolicy.deployed();

    await this.Proxy.executeAction(0, this.Executive.address);
    await this.Proxy.executeAction(2, this.ExecutivePolicy.address);
    await this.Proxy.executeAction(4, this.Executive.address);
  })

  it("initializes state", async function () {
    expect(await this.Executive.totalInstructions()).to.equal(0);
    await expect(this.Executive.storedInstructions(1, 0))
      .to.be.reverted;
    await expect(this.Executive.storedInstructions(1, 1))
      .to.be.reverted;
  })

  it("has functions that can only be called by Proxy Policies", async function() {
    await expect(this.Executive.connect(this.user).launchProxy())
      .to.be.revertedWith("onlyPolicy(): only approved policies can call this function");
  })

  describe("launchProxy()", async function() {
    
    // initial test assumptions
    before(async function() {
      expect(await this.Proxy.startingEpochTimestamp()).to.equal(0);
      expect(await this.Proxy.isLaunched()).to.equal(false);
    })

    it("emits the ProxyLaunched event", async function() {
      await expect(this.ExecutivePolicy.launchProxy())
        .to.emit(this.Executive, "ProxyLaunched")
        .withArgs((await hre.ethers.provider.getBlock("latest")).timestamp);
    })

    it("sets the first epoch timestamp in the Proxy", async function() {
      let epochLength = await this.Proxy.epochLength();
      currentTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;

      let nextEpochTimestamp = epochLength * (Math.floor(currentTimestamp / epochLength) + 1);
      await this.ExecutivePolicy.launchProxy();
    
      expect(await this.Proxy.startingEpochTimestamp()).to.equal(nextEpochTimestamp);
      expect(await this.Proxy.isLaunched()).to.equal(true);
    })
  })

  describe("storeInstructions()", async function() {
    it("emits the 'InstructionsStored' event", async function () {
      await expect(this.ExecutivePolicy.storeInstructions([[0, this.SampleSystem.address]]))
        .to.emit(this.Executive, 'InstructionsStored');
    })

    it("requires proposed policies and systems to be contracts", async function () {
      await expect(this.ExecutivePolicy.storeInstructions([[0, this.dev.address]]))
        .to.be.revertedWith("cannot storeInstructions(): target address is not a contract");
    })

    it("requires instructions to exist", async function () {
      await expect(this.ExecutivePolicy.storeInstructions([]))
        .to.be.revertedWith("cannot storeInstructions(): instructions cannot be empty");
    })

    it("requires proposed systems to have a valid keycode", async function () {
      this.InvalidSystem = await (await ethers.getContractFactory("InvalidSystem")).deploy(this.Proxy.address);
      await this.InvalidSystem.deployed();

      await expect(this.ExecutivePolicy.storeInstructions([[0, this.InvalidSystem.address]]))
        .to.be.revertedWith("cannot storeInstructions(): invalid keycode");

      this.InvalidSystem = await (await ethers.getContractFactory("InvalidSystem2")).deploy(this.Proxy.address);
      await this.InvalidSystem.deployed();

      await expect(this.ExecutivePolicy.storeInstructions([[0, this.InvalidSystem.address]]))
        .to.be.revertedWith("cannot storeInstructions(): invalid keycode");

      this.InvalidSystem = await (await ethers.getContractFactory("InvalidSystem2")).deploy(this.Proxy.address);
        await this.InvalidSystem.deployed();

      await expect(this.ExecutivePolicy.storeInstructions([[0, this.InvalidSystem.address]]))
        .to.be.revertedWith("cannot storeInstructions(): invalid keycode");
    })

    it("requires a proxy executive change to go last in a proposal", async function () {
      this.NewExecutive = await (await ethers.getContractFactory("Executive")).deploy(this.Proxy.address);
      await this.NewExecutive.deployed();

      await expect(this.ExecutivePolicy.storeInstructions([[1, this.NewExecutive.address]]))
        .to.be.revertedWith("cannot storeInstructions(): changes to the Executive system (EXC) requires changing the Proxy executive as the last step of the proposal");

      await expect(this.ExecutivePolicy.storeInstructions([[1, this.NewExecutive.address], [4, this.NewExecutive.address], [2, this.SamplePolicy.address]]))
        .to.be.revertedWith("cannot storeInstructions(): changes to the Executive system (EXC) requires changing the Proxy executive as the last step of the proposal");

      await expect(this.ExecutivePolicy.storeInstructions([[1, this.NewExecutive.address], [4, this.NewExecutive.address]]))
        .to.not.be.reverted;
    })

    it("requires the executive to be changed to the upgraded executive system", async function () {
      this.NewExecutive = await (await ethers.getContractFactory("Executive")).deploy(this.Proxy.address);
      await this.NewExecutive.deployed();

      await expect(this.ExecutivePolicy.storeInstructions([[1, this.NewExecutive.address], [4, this.Executive.address]]))
        .to.be.revertedWith("cannot storeInstructions(): changeExecutive target address does not match the upgraded Executive system address");
    })

    it('increments the totalProposals and starts the first proposal ID at 1', async function () {
      await this.ExecutivePolicy.storeInstructions([[0, this.SampleSystem.address]]);
      expect(await this.Executive.totalInstructions()).to.equal(1);

      await this.ExecutivePolicy.storeInstructions([[2, this.SamplePolicy.address]]);
      expect(await this.Executive.totalInstructions()).to.equal(2);
    })

    it('creates and saves a new proposal in the mapping with instructions from the calldata', async function () {
      await this.ExecutivePolicy.storeInstructions([[0, this.SampleSystem.address], [2, this.SamplePolicy.address]]);
      let proposal_1_firstStep = await this.Executive.storedInstructions(1, 0);
      expect(proposal_1_firstStep[0]).to.equal(0);
      expect(proposal_1_firstStep[1]).to.equal(this.SampleSystem.address);
      expect(proposal_1_firstStep.length).to.equal(2);

      let proposal_1_secondStep = await this.Executive.storedInstructions(1, 1);
      expect(proposal_1_secondStep[0]).to.equal(2);
      expect(proposal_1_secondStep[1]).to.equal(this.SamplePolicy.address);
      expect(proposal_1_secondStep.length).to.equal(2);
    })    
  })

  describe("executeInstructions()", async function() {
    beforeEach(async function () {
      await this.ExecutivePolicy.storeInstructions([[0, this.SampleSystem.address], [2, this.SamplePolicy.address]]);

      this.NewExecutive = await (await ethers.getContractFactory("Executive")).deploy(this.Proxy.address);
      await this.NewExecutive.deployed();

      this.TokenSystem = await (await ethers.getContractFactory("Token")).deploy(this.Proxy.address);
      await this.TokenSystem.deployed();

      await this.ExecutivePolicy.storeInstructions([[0, this.TokenSystem.address], [1, this.NewExecutive.address], [4, this.NewExecutive.address]]);
    })


    it("requires the proposal to exist", async function () {
      await expect(this.ExecutivePolicy.executeInstructions(0))
      .to.be.revertedWith("cannot executeInstructions(): proposal does not exist");

      await expect(this.ExecutivePolicy.executeInstructions(3))
      .to.be.revertedWith("cannot executeInstructions(): proposal does not exist")
    })

    it("emits the 'InstructionsExecuted' event", async function () {
      await expect(this.ExecutivePolicy.executeInstructions(1))
        .to.emit(this.Executive, 'InstructionsExecuted')
        .withArgs(1);
    })

    describe("executes all the instructions in the proposal", async function () {
      it("executes step 1", async function () {
        await expect(this.ExecutivePolicy.executeInstructions(2))
          .to.emit(this.Proxy, "ActionExecuted")
          .withArgs(0, this.TokenSystem.address);
      })

      it("executes step 2", async function () {
        await expect(this.ExecutivePolicy.executeInstructions(2))
          .to.emit(this.Proxy, "ActionExecuted")
          .withArgs(1, this.NewExecutive.address);
      })

      it("executes step 3", async function () {
        await expect(this.ExecutivePolicy.executeInstructions(2))
          .to.emit(this.Proxy, "ActionExecuted")
          .withArgs(4, this.NewExecutive.address);
      })
    })
  })
});
