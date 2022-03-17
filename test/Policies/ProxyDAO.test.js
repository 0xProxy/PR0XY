// test file

const { expect } = require("chai");
const { ZERO_ADDRESS, getBigNumber, incrementWeek } = require("../utils");


describe("ProxyDAO.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];
    this.otherUser = this.signers[2];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.Reputation = await (await ethers.getContractFactory("Reputation")).deploy(this.Proxy.address);
    await this.Reputation.deployed();

    this.Token = await (await ethers.getContractFactory("Token")).deploy(this.Proxy.address);
    await this.Token.deployed();

    this.Treasury = await (await ethers.getContractFactory("Treasury")).deploy(this.Proxy.address);
    await this.Treasury.deployed();
    
    this.VotingPower = await (await ethers.getContractFactory("VotingPower")).deploy(this.Proxy.address);
    await this.VotingPower.deployed();

    await this.Proxy.executeAction(0, this.Reputation.address);
    await this.Proxy.executeAction(0, this.Token.address);
    await this.Proxy.executeAction(0, this.Treasury.address);
    await this.Proxy.executeAction(0, this.VotingPower.address);
    
    this.ProxyDAO = await (await ethers.getContractFactory("ProxyDAO")).deploy(this.Proxy.address);
    await this.ProxyDAO.deployed();

    this.TreasuryPolicy = await (await ethers.getContractFactory("TreasuryPolicy")).deploy(this.Proxy.address);
    await this.TreasuryPolicy.deployed();
   
    this.ReputationPolicy = await (await ethers.getContractFactory("ReputationPolicy")).deploy(this.Proxy.address);
    await this.ReputationPolicy.deployed();

    this.TokenPolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
    await this.TokenPolicy.deployed();

    this.VotingPowerPolicy = await (await ethers.getContractFactory("VotingPowerPolicy")).deploy(this.Proxy.address);
    await this.VotingPowerPolicy.deployed();

    await this.Proxy.executeAction(2, this.ProxyDAO.address);
    await this.Proxy.executeAction(2, this.TreasuryPolicy.address);
    await this.Proxy.executeAction(2, this.ReputationPolicy.address);
    await this.Proxy.executeAction(2, this.TokenPolicy.address);
    await this.Proxy.executeAction(2, this.VotingPowerPolicy.address);

    await this.Proxy.launch();
    await incrementWeek();
    
    expect(await this.Proxy.isLaunched()).to.equal(true);
    expect(await this.Proxy.currentEpoch()).to.equal(1);

    this.Stablecoin = await (await ethers.getContractFactory("ERC20PresetMinterPauser")).deploy("ERC20", "Token");
    await this.Stablecoin.deployed();

    await this.TreasuryPolicy.addTrackedAsset(this.Stablecoin.address);

    await this.Stablecoin.mint(this.user.address, getBigNumber(100));
    await this.Stablecoin.connect(this.user).approve(this.Treasury.address, getBigNumber(100));
    await this.Stablecoin.mint(this.otherUser.address, getBigNumber(100));
    await this.Stablecoin.connect(this.otherUser).approve(this.Treasury.address, getBigNumber(100));
    
    await this.ProxyDAO.connect(this.user).register(this.Stablecoin.address);
  })
  
  
  describe("register()", async function () { 
    it("Registers a Wallet in the Reputation System", async function () {
      await expect(this.ProxyDAO.connect(this.otherUser).register(this.Stablecoin.address))
        .to.emit(this.Reputation, "WalletRegistered")
        .withArgs(this.otherUser.address, "0x1acd");
    })
    
    it("Processes a payment in the Treasury System", async function () {
      await expect(this.ProxyDAO.connect(this.otherUser).register(this.Stablecoin.address))
        .to.emit(this.Treasury, "PaymentProcessed")
        .withArgs(this.otherUser.address, this.Stablecoin.address, getBigNumber(100));
    })
  })

  describe("giveReputation()", async function() {
    it("throws an error if the caller is unregistered", async function () {
      await expect(this.ProxyDAO.connect(this.otherUser).giveReputation("0x0000", 0))
        .to.be.revertedWith("cannot giveReputation(): caller does not have registered wallet")
    })

    it("throws an error if the receiver is not registered", async function () {
      await expect(this.ProxyDAO.connect(this.user).giveReputation("0x0000", 0))
        .to.be.revertedWith("cannot giveReputation(): receiving ID must be associated with a registered wallet")
    })

    it("throws an error if the receiver is the caller", async function () {
      await expect(this.ProxyDAO.connect(this.user).giveReputation("0x7ceb", 0))
        .to.be.revertedWith("cannot giveReputation(): caller cannot give themselves reputation")
    })

    it("throws an error if the user is trying to give more than 200 reputation", async function () {
      await this.ProxyDAO.connect(this.otherUser).register(this.Stablecoin.address);

      otherUserId = await this.Reputation.getId(this.otherUser.address);
      await this.ReputationPolicy.increaseBudget(otherUserId, 250);
      await expect(this.ProxyDAO.connect(this.otherUser).giveReputation("0x7ceb", 201))
        .to.be.revertedWith("cannot giveReputation(): cannot exceed 200 reputation given per member");

    })

    it("increments the receiver's uniqueReps in the Reputation System if the total amount given exceeds 100", async function () {
      await this.ProxyDAO.connect(this.otherUser).register(this.Stablecoin.address);

      otherUserId = await this.Reputation.getId(this.otherUser.address);
      await this.ReputationPolicy.increaseBudget(otherUserId, 250);
      await expect(this.ProxyDAO.connect(this.otherUser).giveReputation("0x7ceb", 100))
        .to.emit(this.Reputation, 'UniqueRepsIncremented')
        .withArgs(await this.Reputation.getId(this.user.address));
    })

    it("adjusts the reputation budget and scores in the Reputation System", async function () {
      await this.ProxyDAO.connect(this.otherUser).register(this.Stablecoin.address);

      otherUserId = await this.Reputation.getId(this.otherUser.address);
      await this.ReputationPolicy.increaseBudget(otherUserId, 100);
      await expect(this.ProxyDAO.connect(this.otherUser).giveReputation("0x7ceb", 18))
        .to.emit(this.Reputation, 'ReputationTransferred')
        .withArgs(otherUserId, await this.Reputation.getId(this.user.address), 18);
    })

    it("gives 100 bonus rep to the receiver if the giver is maxing out their reputation contribution (200)", async function () {
      await this.ProxyDAO.connect(this.otherUser).register(this.Stablecoin.address);

      otherUserId = await this.Reputation.getId(this.otherUser.address);
      await this.ReputationPolicy.increaseBudget(otherUserId, 200);
      expect(await this.Reputation.scoreOfId("0x7ceb")).to.equal(0);

      await expect(this.ProxyDAO.connect(this.otherUser).giveReputation("0x7ceb", 200))
        .to.emit(this.Reputation, 'ReputationTransferred')
        .withArgs("0x0000", "0x7ceb", 100);
      expect(await this.Reputation.scoreOfId("0x7ceb")).to.equal(300);
    })

    it("updates the repsGiven mapping", async function () {
      await this.ProxyDAO.connect(this.otherUser).register(this.Stablecoin.address);

      otherUserId = await this.Reputation.getId(this.otherUser.address);
      await this.ReputationPolicy.increaseBudget(otherUserId, 100);
      expect(await this.ProxyDAO.repsGiven(otherUserId, "0x7ceb")).to.equal(0);

      await this.ProxyDAO.connect(this.otherUser).giveReputation("0x7ceb", 18);
      expect(await this.ProxyDAO.repsGiven(otherUserId, "0x7ceb")).to.equal(18);
    })
  })

  describe ("lockTokens()", async function () {
    beforeEach(async function() {
      await this.TokenPolicy.mint(this.user.address, 1000);
    })

    it("throws an error if the caller is not registered", async function () {
      await expect(this.ProxyDAO.connect(this.otherUser).lockTokens(1000))
        .to.be.revertedWith("cannot lockTokens(): caller does not have a registered proxy Id");
    })
    
    it("burns the tokens locked in the Token System", async function () {
      await expect(this.ProxyDAO.connect(this.user).lockTokens(1000))
        .to.emit(this.Token, 'Transfer')
        .withArgs(this.user.address, ZERO_ADDRESS, 1000);
    })

    it("resets the caller's vesting credits in the Votes System", async function () {
      await expect(this.ProxyDAO.connect(this.user).lockTokens(1000))
        .to.emit(this.VotingPower, 'VestingCreditsReset')
        .withArgs(this.user.address);
    })

    it("issues 1 gPROXY (Vote) per token locked in the Votes System ", async function () {
      await expect(this.ProxyDAO.connect(this.user).lockTokens(1000))
      .to.emit(this.VotingPower, 'Transfer')
      .withArgs(ZERO_ADDRESS, this.user.address, 1000);
    })

    it("increases the caller's reputation budget in the Reputation System", async function () {
      await expect(this.ProxyDAO.connect(this.user).lockTokens(1000))
        .to.emit(this.Reputation, 'BudgetIncreased')
        .withArgs("0x7ceb", 1000);
    })
  })
  
  describe("redeemVotes()", async function () {

    beforeEach(async function() {
      await this.VotingPowerPolicy.issue(this.user.address, 1000);
      await this.VotingPowerPolicy.issue(this.otherUser.address, 2000);
      for (i=0; i<15; i++) {
        await this.VotingPowerPolicy.incrementVestingCredits(this.user.address);
      }
    })

    it("throws an error if the caller doesn't have 15 vesting credits in the Votes System", async function () {
      await expect(this.ProxyDAO.connect(this.otherUser).redeemVotes(2000))
        .to.be.revertedWith("cannot redeemVotes(): caller doesn't have enough vesting credits");
    })

    it("burns the gPROX redeemed in the Votes System", async function () {
      await expect(this.ProxyDAO.connect(this.user).redeemVotes(1000))
        .to.emit(this.VotingPower, 'Transfer')
        .withArgs(this.user.address, ZERO_ADDRESS, 1000);
    })

    it("mints the redeemer 1 PROX per Vote (gPROX) redeemed", async function () {
      await expect(this.ProxyDAO.connect(this.user).redeemVotes(1000))
        .to.emit(this.Token, 'Transfer')
        .withArgs(ZERO_ADDRESS, this.user.address, 1000);
    })
  })
})