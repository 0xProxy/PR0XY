// test file

const { expect } = require("chai");
const { ZERO_ADDRESS, getBigNumber, incrementWeek } = require("../utils");


describe("TokenSale.sol", function () {
  // using before, not beforeEach: tests share the same contract instances!
  before(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];
    this.otherUser = this.signers[2];

    this.Stablecoin = await (await ethers.getContractFactory("ERC20PresetMinterPauser")).deploy("ERC20", "Token");
    await this.Stablecoin.deployed();

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.Reputation = await (await ethers.getContractFactory("Reputation")).deploy(this.Proxy.address);
    await this.Reputation.deployed();

    this.Token = await (await ethers.getContractFactory("Token")).deploy(this.Proxy.address);
    await this.Token.deployed();

    this.Treasury = await (await ethers.getContractFactory("Treasury")).deploy(this.Proxy.address);
    await this.Treasury.deployed();

    await this.Proxy.executeAction(0, this.Reputation.address);
    await this.Proxy.executeAction(0, this.Token.address);
    await this.Proxy.executeAction(0, this.Treasury.address);
    
    this.TokenSale = await (await ethers.getContractFactory("TokenSale")).deploy(this.Proxy.address);
    await this.TokenSale.deployed();

    this.TreasuryPolicy = await (await ethers.getContractFactory("TreasuryPolicy")).deploy(this.Proxy.address);
    await this.TreasuryPolicy.deployed();
    
    this.ReputationPolicy = await (await ethers.getContractFactory("ReputationPolicy")).deploy(this.Proxy.address);
    await this.ReputationPolicy.deployed();

    await this.Proxy.executeAction(2, this.TokenSale.address);
    await this.Proxy.executeAction(2, this.TreasuryPolicy.address);
    await this.Proxy.executeAction(2, this.ReputationPolicy.address);

    await this.TreasuryPolicy.addTrackedAsset(this.Stablecoin.address);

    await this.Stablecoin.mint(this.user.address, getBigNumber(500000));
    await this.Stablecoin.connect(this.user).approve(this.Treasury.address, getBigNumber(500000));
    await this.Stablecoin.mint(this.otherUser.address, getBigNumber(1100000));
    await this.Stablecoin.connect(this.otherUser).approve(this.Treasury.address, getBigNumber(1100000));
  })

  describe("purchase()", async function () { 
    it('requires the caller to be registered', async function () {
      await expect(this.TokenSale.connect(this.user).purchase(1, this.Stablecoin.address))
      .to.be.revertedWith("cannot find getAllocationOf(): caller is not a registered wallet")
    })

    describe("weekly purchasing limits up to the minimum of reputation / 10, uniqueReps * 30, or 2000 PROX tokens", async function () {
      before(async function () {
        await this.ReputationPolicy.registerWallet(this.user.address);
        await this.ReputationPolicy.increaseBudget("0x0000", 50000);
      })

      it("allows up to the minimum of reputation / 10, uniqueReps * 30, or 2000 PROX tokens", async function () {
        await this.ReputationPolicy.transferReputation("0x0000", "0x7ceb", 300);
  
        await expect(this.TokenSale.connect(this.user).purchase(1, this.Stablecoin.address))
            .to.be.revertedWith("cannot purchaseToken(): not enough token sale allocation")
      })
      
      it("allows 30 tokens to be purchased with 300 Rep and 1 uniqueRep", async function() {
        await this.ReputationPolicy.incrementUniqueReps("0x7ceb");

        await expect(this.TokenSale.connect(this.user).purchase(31, this.Stablecoin.address))
          .to.be.revertedWith("cannot purchaseToken(): not enough token sale allocation")
        
        await expect(this.TokenSale.connect(this.user).purchase(30, this.Stablecoin.address))
          .to.emit(this.Stablecoin, 'Transfer')
          .withArgs(this.user.address, this.Treasury.address, getBigNumber(150));
      })

      it("allows 480 tokens to be purchased with 4800 reputation and 67 uniqueReps", async function () {
        await this.Proxy.launch();
        await incrementWeek();
        
        expect(await this.Proxy.isLaunched()).to.equal(true);
        expect(await this.Proxy.currentEpoch()).to.equal(1);

        for(i=0; i<67; i++) {
          await this.ReputationPolicy.incrementUniqueReps("0x7ceb");
        }

        await this.ReputationPolicy.transferReputation("0x0000", "0x7ceb", 4500);
        await expect(this.TokenSale.connect(this.user).purchase(481, this.Stablecoin.address))
          .to.be.revertedWith("cannot purchaseToken(): not enough token sale allocation");
        
        await expect(this.TokenSale.connect(this.user).purchase(480, this.Stablecoin.address))
          .to.emit(this.Token, 'Transfer')
          .withArgs(ZERO_ADDRESS, this.user.address, 480);
      })

      it("allows the max token purchase at 20000 reputation and 67 uniqueReps", async function () {
        await incrementWeek();
        expect(await this.Proxy.currentEpoch()).to.equal(2);

        await this.ReputationPolicy.transferReputation("0x0000", "0x7ceb", 15200);
        await expect(this.TokenSale.connect(this.user).purchase(2001, this.Stablecoin.address))
          .to.be.revertedWith("cannot purchaseToken(): not enough token sale allocation");
        
        await expect(this.TokenSale.connect(this.user).purchase(2000, this.Stablecoin.address))
          .to.emit(this.Token, 'Transfer')
          .withArgs(ZERO_ADDRESS, this.user.address, 2000);

        // max tokens purchased; no more tokens can be purchased this epoch

        await this.ReputationPolicy.transferReputation("0x0000", "0x7ceb", 10000);
        await this.ReputationPolicy.incrementUniqueReps("0x7ceb");

        await expect(this.TokenSale.connect(this.user).purchase(1, this.Stablecoin.address))
          .to.be.revertedWith("cannot purchaseToken(): not enough token sale allocation");
      })
    })
  })
})