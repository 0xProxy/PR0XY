// test file

const { expect } = require("chai");
const { log } = require("console");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, incrementWeek } = require("../utils");


describe("Governance.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];
    this.user2 = this.signers[2];
    this.user3 = this.signers[3];


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
    
    await this.Proxy.executeAction(0, this.Executive.address);
    await this.Proxy.executeAction(0, this.Reputation.address);
    await this.Proxy.executeAction(0, this.Token.address);
    await this.Proxy.executeAction(0, this.Treasury.address);
    await this.Proxy.executeAction(0, this.VotingPower.address);

    
    this.Governance = await (await ethers.getContractFactory("Governance")).deploy(this.Proxy.address);
    await this.Governance.deployed();

    this.ReputationPolicy = await (await ethers.getContractFactory("ReputationPolicy")).deploy(this.Proxy.address);
    await this.ReputationPolicy.deployed();

    this.ExecutivePolicy = await (await ethers.getContractFactory("ExecutivePolicy")).deploy(this.Proxy.address);
    await this.ExecutivePolicy.deployed();

    this.TokenPolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
    await this.TokenPolicy.deployed();

    this.TreasuryPolicy = await (await ethers.getContractFactory("TreasuryPolicy")).deploy(this.Proxy.address);
    await this.Executive.deployed();

    this.VotingPowerPolicy = await (await ethers.getContractFactory("VotingPowerPolicy")).deploy(this.Proxy.address);
    await this.VotingPowerPolicy.deployed();
    
    await this.Proxy.executeAction(2, this.Governance.address);
    await this.Proxy.executeAction(2, this.ReputationPolicy.address);
    // await this.Proxy.executeAction(2, this.ExecutivePolicy.address);
    // await this.Proxy.executeAction(2, this.TokenPolicy.address);
    // await this.Proxy.executeAction(2, this.TreasuryPolicy.address);
    await this.Proxy.executeAction(2, this.VotingPowerPolicy.address);

    await this.Proxy.launch();
    await incrementWeek();
    await incrementWeek();
    await this.Proxy.executeAction(4, this.Executive.address);

    // ********************************* SETUP *************************************

    await this.ReputationPolicy.registerWallet(this.dev.address);
    await this.ReputationPolicy.registerWallet(this.user.address);
    await this.ReputationPolicy.registerWallet(this.user2.address);
    await this.ReputationPolicy.registerWallet(this.user3.address);

    this.userId = await this.Reputation.getId(this.user.address);
    for (let i=0; i<5; i++) {
      await this.ReputationPolicy.incrementUniqueReps(this.userId);
    }
    await this.ReputationPolicy.increaseBudget("0x0000", 1000);
    await this.ReputationPolicy.transferReputation("0x0000", this.userId, 1);
    // await this.ReputationPolicy.giveReptuation("0x0000", this.userId, 5);
    // await this.ReputationPolicy.giveReptuation("0x0000", this.userId, 5);'

    this.SampleTokenPolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
    await this.SampleTokenPolicy.deployed();
  })


  describe("submitProposal()", async function () {
    beforeEach(async function () {
      this.proposalName = ethers.utils.formatBytes32String("New Token Policy")
    })

    it("requires the caller to be registered in the DAO", async function(){
      await expect(this.Governance.connect(this.user3).submitProposal(this.proposalName, [], []))
        .to.be.revertedWith("cannot submitProposal(): caller needs at least 5 unique reps to submit proposal");
    })

    it("requires coauthors length > 0", async function () {
      await expect(this.Governance.connect(this.user).submitProposal(this.proposalName, [], []))
        .to.be.revertedWith("cannot submitProposal(): there needs to be at least one author of the proposal");
    })

    it("requires each coauthor to have more than 0 reputation", async function () {
      await expect(this.Governance.connect(this.user).submitProposal(this.proposalName, [], ["0x0000"]))
        .to.be.revertedWith("cannot submitProposal(): coauthors must have greater than 0 reputation");
    })
    
    it("emits the 'InstructionsStored' event in the Executive System", async function () {
      await expect(this.Governance.connect(this.user).submitProposal(this.proposalName, [[2, this.SampleTokenPolicy.address]], [this.userId]))
        .to.emit(this.Executive, 'InstructionsStored')
        .withArgs(1);
    })

    it("updates the proposalForInstructionId mapping", async function () {
      await this.Governance.connect(this.user).submitProposal(this.proposalName, [[2, this.SampleTokenPolicy.address]], [this.userId]);
      let proposal = await this.Governance.proposalForInstructionsId(1);
      expect(proposal[0]).to.equal(this.proposalName);
      expect(proposal[1]).to.equal(1);
      expect(proposal[2]).to.equal(this.user.address);

      // console.log(proposal);
      // there's no way I know of to test coauthors? fingers crossed it works... ;D
    })
  })

  describe("endorseProposal()", async function() {
    beforeEach(async function () {
      this.proposalName = ethers.utils.formatBytes32String("New Token Policy")
      await this.Governance.connect(this.user).submitProposal(this.proposalName, [[2, this.SampleTokenPolicy.address]], [this.userId]);

      await this.VotingPowerPolicy.issue(this.user.address, 1000);
    })

    it("reverts if a user has no VTP", async function () {
      await expect(this.Governance.connect(this.user2).endorseProposal(1))
        .to.be.revertedWith("cannot endorseProposal(): user doesn't have enough voting power to endorse proposal")
    })

    it("revert if a user has some VTP and tries to vote twice", async function () {
      await expect(this.Governance.connect(this.user).endorseProposal(1))
        .to.not.be.reverted;

      await expect(this.Governance.connect(this.user).endorseProposal(1))
        .to.be.revertedWith("cannot endorseProposal(): user doesn't have enough voting power to endorse proposal")
    })

    it("updates the userEndorsementsForProposal and endorsemenetForProposal mappings", async function () {
      await this.Governance.connect(this.user).endorseProposal(1);
      expect(await this.Governance.userEndorsementsForProposal(this.user.address, 1)).to.equal(1000);
      expect(await this.Governance.endorsementsForProposal(1)).to.equal(1000);
    })

    it("updates both mappings if the user has increased VTP and endorses again", async function () {
      await this.VotingPowerPolicy.rebase(5000); // rebase 50%;
      await expect(this.Governance.connect(this.user).endorseProposal(1))
        .to.not.be.reverted;    

      expect(await this.Governance.userEndorsementsForProposal(this.user.address, 1)).to.equal(1500);
      expect(await this.Governance.endorsementsForProposal(1)).to.equal(1500);
    })

  })

  describe ("stageProposal()", async function () {
    beforeEach(async function () {

      this.devId = await this.Reputation.getId(this.dev.address);
      this.user2Id = await this.Reputation.getId(this.user2.address);
      this.proposalName = ethers.utils.formatBytes32String("New Token Policy")

      await this.ReputationPolicy.transferReputation("0x0000", this.user2Id, 1);
      await this.ReputationPolicy.transferReputation("0x0000", this.devId, 1);
      await this.Governance.connect(this.user).submitProposal(this.proposalName, [[2, this.SampleTokenPolicy.address]], [this.userId, this.user2Id, this.devId]);

      await this.VotingPowerPolicy.issue(this.dev.address, 1000);
      await this.VotingPowerPolicy.issue(this.user.address, 2000);
      await this.VotingPowerPolicy.issue(this.user2.address, 3000);
      await this.VotingPowerPolicy.issue(this.user3.address, 4000);

      for (let i=0; i<5; i++) {
        await this.ReputationPolicy.incrementUniqueReps(this.user2Id);
      }
    
    })

    it("require the caller to be the original proposer", async function () {
      await expect(this.Governance.connect(this.user2).stageProposal(1))
        .to.be.revertedWith("cannot stageProposal(): only the original proposer can stage it for a vote");  
    })

    it("require the endorsements for the proposer to be at least 20% of the totalSupply of VotingPower", async function () {
      await expect(this.Governance.connect(this.user).stageProposal(1))
        .to.be.revertedWith("cannot stageProposal(): proposal needs at least 1/5 of max endorsements to be staged")
    })

    it("require the proposal to have not been staged previously", async function () {
      await this.Governance.connect(this.dev).endorseProposal(1);
      await this.Governance.connect(this.user).endorseProposal(1);
      await this.Governance.connect(this.user).stageProposal(1);
      await expect(this.Governance.connect(this.user).stageProposal(1))
        .to.be.revertedWith("cannot stageProposal(): proposal has already been staged before")
    })

    it("require 2 weeks to have passed if there is a previously staged proposal", async function () {
      await this.Governance.connect(this.dev).endorseProposal(1);
      await this.Governance.connect(this.user).endorseProposal(1);
      await this.Governance.connect(this.user).stageProposal(1);

      await this.Governance.connect(this.user2).submitProposal(this.proposalName, [[2, this.SampleTokenPolicy.address]], [this.user2Id, this.devId]);
      await this.Governance.connect(this.dev).endorseProposal(2);
      await this.Governance.connect(this.user).endorseProposal(2);

      await expect(this.Governance.connect(this.user2).stageProposal(2))
        .to.be.revertedWith("cannot stageProposal(): currently staged proposal has not expired");

      await incrementWeek();
      await incrementWeek();

      await expect(this.Governance.connect(this.user2).stageProposal(2))
        .to.not.be.reverted;
    })

    it("updates the proposalHasStaged mapping", async function () {
      await this.Governance.connect(this.dev).endorseProposal(1);
      await this.Governance.connect(this.user).endorseProposal(1);
      await this.Governance.connect(this.user).stageProposal(1);

      expect(await this.Governance.proposalHasStaged(1)).to.equal(true);
    })

    it("updates the stagedProposal variable", async function () {
      await incrementWeek();
      await incrementWeek();
      await this.Governance.connect(this.dev).endorseProposal(1);
      await this.Governance.connect(this.user).endorseProposal(1);
      await this.Governance.connect(this.user).stageProposal(1);

      let stagedProposal = await this.Governance.stagedProposal()
      expect(stagedProposal[0]).to.equal(1);
      expect(stagedProposal[1]).to.equal(4);

    })
  })    
  
  describe ("vote()", async function () {
    beforeEach(async function () {
      this.devId = await this.Reputation.getId(this.dev.address);
      this.user2Id = await this.Reputation.getId(this.user2.address);
      this.proposalName = ethers.utils.formatBytes32String("New Token Policy")

      await this.ReputationPolicy.transferReputation("0x0000", this.user2Id, 1);
      await this.ReputationPolicy.transferReputation("0x0000", this.devId, 1);
      await this.Governance.connect(this.user).submitProposal(this.proposalName, [[2, this.SampleTokenPolicy.address]], [this.userId, this.user2Id, this.devId]);

      await this.VotingPowerPolicy.issue(this.dev.address, 1000);
      await this.VotingPowerPolicy.issue(this.user.address, 2000);
      await this.VotingPowerPolicy.issue(this.user2.address, 3000);
      await this.VotingPowerPolicy.issue(this.user3.address, 4000);

      await this.Governance.connect(this.dev).endorseProposal(1);
      await this.Governance.connect(this.user).endorseProposal(1);
      await this.Governance.connect(this.user).stageProposal(1);

      await this.Governance.connect(this.dev).vote(true);
      await this.Governance.connect(this.user).vote(false);
    })

    it("require the userNetVotesForProposal to be 0 (not voted)", async function () {
      await expect(this.Governance.connect(this.user).vote(true))
        .to.be.revertedWith("cannot voteOnStagedProposal(): user can only vote once");

      await expect(this.Governance.connect(this.dev).vote(true))
        .to.be.revertedWith("cannot voteOnStagedProposal(): user can only vote once");
    })

    it("updates the userNetVotesForProposal mapping", async function () {
      expect(await this.Governance.userNetVotesForProposal(this.user.address, 1)).to.equal(-2000);
      expect(await this.Governance.userNetVotesForProposal(this.dev.address, 1)).to.equal(1000);
    })

    it("updates the netVotesForProposal mapping", async function () {
      expect(await this.Governance.netVotesForProposal(1)).to.equal(-1000);
    })

    describe("when the netvotes for the proposal passes a 40% threshold", async function () {
      beforeEach(async function () {
        await this.Governance.connect(this.user2).vote(true);
        await expect(this.Governance.connect(this.user3).vote(true))
          .to.emit(this.Executive, 'InstructionsExecuted')
          .withArgs(1)
      })

      it("evenly distributes the (2%) token bounty reward across all the coauthors", async function () {
        expect(await this.Token.balanceOf(this.dev.address)).to.equal(66);
        expect(await this.Token.balanceOf(this.user.address)).to.equal(66);
        expect(await this.Token.balanceOf(this.user2.address)).to.equal(66);
      })

      it("resets the vesting credits for all receiving authors", async function () {
        expect(await this.VotingPower.vestingCreditsOf(this.dev.address)).to.equal(0);
        expect(await this.VotingPower.vestingCreditsOf(this.user.address)).to.equal(0);
        expect(await this.VotingPower.vestingCreditsOf(this.user2.address)).to.equal(0);
      })

      it("rebases VTP", async function () {
        expect(await this.VotingPower.balanceOf(this.dev.address)).to.equal(1050);
        expect(await this.VotingPower.balanceOf(this.user.address)).to.equal(2100);
        expect(await this.VotingPower.balanceOf(this.user2.address)).to.equal(3150);
      })

      it("Executes the corresponding instructions in the Executive system", async function () {
        // tested in the beforeEach hook
      })

      it("resets the stagedProposal", async function () {
        let stagedProposal = await this.Governance.stagedProposal();
        expect(stagedProposal[0]).to.equal(0);
        expect(stagedProposal[1]).to.equal(0);
      })
    })

    describe("when the netvotes for the proposal passes -30% threshold", async function () {
      it("rebases VTP", async function () {
        await expect(this.Governance.connect(this.user2).vote(false))
          .to.emit(this.VotingPower, 'Rebased')
          .withArgs(500);
        
        expect(await this.VotingPower.balanceOf(this.dev.address)).to.equal(1050);
        expect(await this.VotingPower.balanceOf(this.user.address)).to.equal(2100);
        expect(await this.VotingPower.balanceOf(this.user2.address)).to.equal(3150);
      })

      it("resets the stagedProposal", async function () {
        await this.Governance.connect(this.user3).vote(false);
        let stagedProposal = await this.Governance.stagedProposal();
        expect(stagedProposal[0]).to.equal(0);
        expect(stagedProposal[1]).to.equal(0);
      })
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