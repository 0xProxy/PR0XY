// test file

const { flattenProject } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { log } = require("console");
const { ethers } = require("hardhat");
const { createImportSpecifier } = require("typescript");


describe("Prelaunch.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.Reputation = await (await ethers.getContractFactory("Reputation")).deploy(this.Proxy.address);
    await this.Reputation.deployed();

    this.Token = await (await ethers.getContractFactory("Token")).deploy(this.Proxy.address);
    await this.Token.deployed();

    this.Executive = await (await ethers.getContractFactory("Executive")).deploy(this.Proxy.address);
    await this.Executive.deployed();
    
    await this.Proxy.executeAction(0, this.Executive.address);
    await this.Proxy.executeAction(0, this.Reputation.address);
    await this.Proxy.executeAction(0, this.Token.address);
    
    this.Prelaunch = await (await ethers.getContractFactory("Prelaunch")).deploy(this.Proxy.address);
    await this.Prelaunch.deployed();

    this.ReputationPolicy = await (await ethers.getContractFactory("ReputationPolicy")).deploy(this.Proxy.address);
    await this.ReputationPolicy.deployed();
    
    await this.Proxy.executeAction(2, this.Prelaunch.address);
    await this.Proxy.executeAction(2, this.ReputationPolicy.address);
    await this.Proxy.executeAction(4, this.Executive.address);
  })


  describe("approvePreregistrationFor()", async function () {
    it("can only be called by the dev", async function () {
      await expect(this.Prelaunch.connect(this.user).approvePreregistrationFor(this.user.address)).to.be.revertedWith("prelaunchOnly() failed: caller is not the dev");
    })

    it("marks the user as approved", async function () {
      await this.Prelaunch.approvePreregistrationFor(this.user.address);
      expect(await this.Prelaunch.isApproved(this.user.address)).to.equal(true);
    })
  })

  describe("preregister()", async function() {
    it("can only be called if approved", async function () {
      await expect(this.Prelaunch.connect(this.user).preregister()).to.be.revertedWith("cannot register() during prelaunch: member is not preapproved");
    })

    it("Registers a Wallet in the Reputation System", async function () {
      await this.Prelaunch.approvePreregistrationFor(this.user.address);
      await expect(this.Prelaunch.connect(this.user).preregister())
        .to.emit(this.Reputation, "WalletRegistered")
        .withArgs(this.user.address, "0x7ceb");
    })
    
    it("Increments their Reputation Budget in the Reputation System", async function () {
      await this.Prelaunch.approvePreregistrationFor(this.user.address);
      await expect(this.Prelaunch.connect(this.user).preregister())
        .to.emit(this.Reputation, "BudgetIncreased")
        .withArgs("0x7ceb", 100);
    })
  })

  describe ("claimLaunchBonus()", async function () {
    it("requires caller to have a Proxy ID", async function () {
      await expect(this.Prelaunch.connect(this.user).claimLaunchBonus()).to.be.revertedWith("cannot claimLaunchBonus(): caller does not have a Proxy ID");
    })

    it("requires caller to have at least 150 reputation", async function () {
      await this.Prelaunch.approvePreregistrationFor(this.user.address);
      await this.Prelaunch.connect(this.user).preregister();
      await expect(this.Prelaunch.connect(this.user).claimLaunchBonus()).to.be.revertedWith("cannot claimLaunchSlot(): member does not have the required reputation");
    })

    it("requires caller to have at least 5 uniqueRep", async function () {
      await this.Prelaunch.approvePreregistrationFor(this.user.address);
      await this.Prelaunch.connect(this.user).preregister();
      let memberId = await this.Reputation.getId(this.user.address)

      await this.ReputationPolicy.increaseBudget("0x0000", 150);
      await this.ReputationPolicy.transferReputation("0x0000", memberId, 150);
      await expect(this.Prelaunch.connect(this.user).claimLaunchBonus()).to.be.revertedWith("cannot claimLaunchSlot(): member does not have the required uniqueReps");
    })

    it("updates the isClaimed mapping and claimAddreses list", async function () {
      await this.Prelaunch.approvePreregistrationFor(this.user.address);
      await this.Prelaunch.connect(this.user).preregister();
      let memberId = await this.Reputation.getId(this.user.address)

      await this.ReputationPolicy.increaseBudget("0x0000", 150);
      await this.ReputationPolicy.transferReputation("0x0000", memberId, 150);
      for (i=0; i<5; i++) {
        await this.ReputationPolicy.incrementUniqueReps(memberId);
      }

      await this.Prelaunch.connect(this.user).claimLaunchBonus();
      expect(await this.Prelaunch.isClaimed(memberId)).to.equal(true);
      expect(await this.Prelaunch.claimAddresses(0)).to.equal(this.user.address);      
    })
    
    it("can only be claimed once", async function () {
      await this.Prelaunch.approvePreregistrationFor(this.user.address);
      await this.Prelaunch.connect(this.user).preregister();
      let memberId = await this.Reputation.getId(this.user.address)

      await this.ReputationPolicy.increaseBudget("0x0000", 150);
      await this.ReputationPolicy.transferReputation("0x0000", memberId, 150);
      for (i=0; i<5; i++) {
        await this.ReputationPolicy.incrementUniqueReps(memberId);
      }

      await this.Prelaunch.connect(this.user).claimLaunchBonus();
      await expect(this.Prelaunch.connect(this.user).claimLaunchBonus()).to.be.revertedWith("cannot claimLaunchSlot(): member has already claimed a slot");
    })
    
    it("launches the project on the 35th successful claim", async function () {
      for (i=1; i<=35; i++) {
        await this.Prelaunch.connect(this.dev).approvePreregistrationFor(this.signers[i].address);
        await this.Prelaunch.connect(this.signers[i]).preregister();
        let memberId = await this.Reputation.getId(this.signers[i].address)
        await this.ReputationPolicy.increaseBudget("0x0000", 150);
        await this.ReputationPolicy.transferReputation("0x0000", memberId, 150);
        for (j=0; j<5; j++) {
          await this.ReputationPolicy.incrementUniqueReps(memberId);
        }
        i != 35 && await this.Prelaunch.connect(this.signers[i]).claimLaunchBonus();
      }

      await expect(this.Prelaunch.connect(this.signers[35]).claimLaunchBonus())
        .to.emit(this.Executive, "ProxyLaunched")
    })

    it("distributes 50 PROX to each claimed address on the 35th claim", async function () {
      for (i=1; i<=35; i++) {
        await this.Prelaunch.connect(this.dev).approvePreregistrationFor(this.signers[i].address);
        await this.Prelaunch.connect(this.signers[i]).preregister();
        let memberId = await this.Reputation.getId(this.signers[i].address)
        await this.ReputationPolicy.increaseBudget("0x0000", 150);
        await this.ReputationPolicy.transferReputation("0x0000", memberId, 150);
        for (j=0; j<5; j++) {
          await this.ReputationPolicy.incrementUniqueReps(memberId);
        }

        expect(await this.Token.balanceOf(this.signers[i].address)).to.equal(0);
        await this.Prelaunch.connect(this.signers[i]).claimLaunchBonus();
      }

      for (i=1; i<=35; i++) {
        expect(await this.Token.balanceOf(this.signers[i].address)).to.equal(50000);
      }
    })

    it("throws an error if called after the project has launched", async function () {
      for (i=1; i<=36; i++) {
        await this.Prelaunch.connect(this.dev).approvePreregistrationFor(this.signers[i].address);
        await this.Prelaunch.connect(this.signers[i]).preregister();

        let memberId = await this.Reputation.getId(this.signers[i].address)
        await this.ReputationPolicy.increaseBudget("0x0000", 150);
        await this.ReputationPolicy.transferReputation("0x0000", memberId, 150);
        for (j=0; j<5; j++) {
          await this.ReputationPolicy.incrementUniqueReps(memberId);
        }

        i != 36 && await this.Prelaunch.connect(this.signers[i]).claimLaunchBonus();
      }

      await expect(this.Prelaunch.connect(this.signers[36]).claimLaunchBonus())
        .to.be.revertedWith("cannot claimLaunchSlot(): project has already been launched");
    })
  })    
})


//

// For integration test

// for ( i = 1; i <= 35; i++ ) { 
//   tranche = Math.floor((i - 1) / 4);
//   // console.log("SIGNER: ", i, "  |  TRANCHE: ", tranche);
//   position = (i - 1) % 4;

//   firstGiver = ((tranche * 5 + 2)) + position

//   for ( j = firstGiver; j < firstGiver + 5; j++ ) {
//     // console.log("receiving from: ", j);
    
//     let giverId =  await this.Reputation.getId(this.signers[j].address);
//     let receiverId = await this.Reputation.getId(this.signers[i].address);

//     await this.ReputationPolicy.transferReputation(giverId, receiverId, 25);
//   }
  
//   i != 35 && await this.Prelaunch.connect(this.signers[i]).claimLaunchBonus();
// }