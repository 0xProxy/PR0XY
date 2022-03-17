const { expect } = require("chai");
const { ethers } = require("hardhat");
const { incrementWeek, systemKeycode, ZERO_ADDRESS } = require("./utils.js")

describe("Proxy", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();
  })

  it("sets the correct initial state", async function () {
    expect(await this.Proxy.startingEpochTimestamp()).to.equal(0);
    expect(await this.Proxy.isLaunched()).to.equal(false);
    expect(await this.Proxy.epochLength()).to.equal(604800);
    expect(await this.Proxy.executive()).to.equal(this.dev.address);

    expect(await this.Proxy.getSystemForKeycode(systemKeycode("XXX"))).to.equal(ZERO_ADDRESS);
    expect(await this.Proxy.getKeycodeForSystem(ZERO_ADDRESS)).to.equal("0x000000");
    expect(await this.Proxy.approvedPolicies(ZERO_ADDRESS)).to.equal(false);
  })

  it("only allows certain functions to be called by the executive", async function () {
    await expect(this.Proxy.connect(this.user).launch())
      .to.be.revertedWith("onlyExecutive(): only the assigned executive can call the function");

    await expect(this.Proxy.connect(this.user).executeAction(0, this.user.address))
      .to.be.revertedWith("onlyExecutive(): only the assigned executive can call the function");
  })

  describe("Epoch/timekeeping", async function() {
  
    describe("currentEpoch()", async function() {
      it("returns 0 if the protocol is unlaunched", async function() {
        expect(await this.Proxy.currentEpoch()).to.equal(0);
      })

      it("returns 0 if the protocol is launched and no time has passed", async function () {
        await this.Proxy.launch();
        expect(await this.Proxy.currentEpoch()).to.equal(0);
      })

      it("returns the number of weeks passed after the protocol launched", async function () {
        await this.Proxy.launch();
        expect(await this.Proxy.currentEpoch()).to.equal(0);
        await incrementWeek();
        expect(await this.Proxy.currentEpoch()).to.equal(1);
        await incrementWeek();
        expect(await this.Proxy.currentEpoch()).to.equal(2);
      })
    })

    describe("launch()", async function () {
      it("reverts if the project is already launched", async function () {
        await this.Proxy.launch();
        await expect(this.Proxy.launch())
          .to.be.revertedWith("cannot launch(): Proxy is already launched");
      })

      it("sets the starting epoch to the next weekly multiple of the genesis epoch(epoch 0) in the future", async function () {
        await this.Proxy.launch();

        let latestTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
        let nextEpochTimestamp = 604800 * (Math.floor(latestTimestamp / 604800) + 1);
        expect(await this.Proxy.startingEpochTimestamp()).to.equal(nextEpochTimestamp);
      })
    })
  })

  describe("Dependency management/upgradability", async function () {
    beforeEach(async function () {
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

      this.TokenUpgraded = await (await ethers.getContractFactory("TokenUpgraded")).deploy(this.Proxy.address);
      await this.TokenUpgraded.deployed();
    })

    describe("ExecuteAction", async function () {

      describe("_installSystem()", async function () {
        beforeEach(async function () {
          await this.Proxy.executeAction(0, this.Token.address);
        })

        it("reverts if a keycode already exists", async function () {
          await expect(this.Proxy.executeAction(0, this.TokenUpgraded.address))
            .to.be.revertedWith("cannot _installSystem(): Existing system found for keycode");
        })
       
        it("updates the proper mappings", async function () {
          expect(await this.Proxy.getSystemForKeycode(systemKeycode("TKN"))).to.equal(this.Token.address);
          expect(await this.Proxy.getKeycodeForSystem(this.Token.address)).to.equal(systemKeycode("TKN"));
        })
      })

      describe("_upgradeSystem()", async function () {
        it("reverts if there is no existing system available to upgrade", async function () {
          await expect(this.Proxy.executeAction(1, this.Token.address))
            .to.be.revertedWith("cannot _upgradeSystem(): an existing system must be upgraded to a new system");
        })

        it("reverts if the target upgrade is the existing system", async function() {
          await this.Proxy.executeAction(0, this.Token.address);
          await expect(this.Proxy.executeAction(1, this.Token.address))
            .to.be.revertedWith("cannot _upgradeSystem(): an existing system must be upgraded to a new system");
        })

        it("updates the proper mappings", async function () {
          await this.Proxy.executeAction(0, this.Token.address);
          await this.Proxy.executeAction(1, this.TokenUpgraded.address);

          expect(await this.Proxy.getSystemForKeycode(systemKeycode("TKN"))).to.equal(this.TokenUpgraded.address);
          expect(await this.Proxy.getKeycodeForSystem(this.TokenUpgraded.address)).to.equal(systemKeycode("TKN"));
          expect(await this.Proxy.getKeycodeForSystem(this.Token.address)).to.equal("0x000000");
        })

        it("successfully reconfigures policies", async function () {
          await this.Proxy.executeAction(0, this.Token.address);
          this.TokenPolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
          await this.TokenPolicy.deployed();

          await this.Proxy.executeAction(2, this.TokenPolicy.address);
          await expect(this.Proxy.executeAction(1, this.TokenUpgraded.address))
            .to.not.be.reverted;

          await this.TokenPolicy.mint(this.user.address, 1000);
          expect(await this.TokenUpgraded.balanceOf(this.user.address)).to.equal(1000);
        })
      })

      describe("_approvePolicy", async function () {
        beforeEach(async function () {
          await this.Proxy.executeAction(0, this.Token.address);
          this.TokenPolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
          await this.TokenPolicy.deployed();

          await this.Proxy.executeAction(2, this.TokenPolicy.address);
        })

        it("reverts if the address is already approved", async function () {
          await expect(this.Proxy.executeAction(2, this.TokenPolicy.address))
            .to.be.revertedWith("cannot _approvePolicy(): Policy is already approved");
        })

        it("updates the approvedPolicies mapping and allPolicies list", async function () {
          expect(await this.Proxy.approvedPolicies(this.TokenPolicy.address)).to.equal(true);
          expect(await this.Proxy.allPolicies(0)).to.equal(this.TokenPolicy.address);
        })
      })

      describe("_terminatePolicy", async function () {
        beforeEach(async function () {
          await this.Proxy.executeAction(0, this.Token.address);
          this.TokenPolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
          await this.TokenPolicy.deployed();

          await this.Proxy.executeAction(2, this.TokenPolicy.address);
        })

        it("reverts if the policy is not already approved", async function () {
          await this.Proxy.executeAction(3, this.TokenPolicy.address);
          await expect(this.Proxy.executeAction(3, this.TokenPolicy.address))
            .to.be.revertedWith("cannot _terminatePolicy(): Policy is not approved");
        })

        it("updates the approvedPolicies mapping but not the allPolicies list", async function () {
          await this.Proxy.executeAction(3, this.TokenPolicy.address);
          expect(await this.Proxy.approvedPolicies(this.TokenPolicy.address)).to.equal(false);
          expect(await this.Proxy.allPolicies(0)).to.equal(this.TokenPolicy.address);
        })
      })


      describe("_changeExecutive", async function () {
        it("changes the Executive", async function () {
          await this.Proxy.executeAction(0, this.Executive.address);
          await this.Proxy.executeAction(4, this.Executive.address);
          
          await expect(this.Proxy.connect(this.user).executeAction(0, this.Reputation.address))
          .to.be.revertedWith("onlyExecutive(): only the assigned executive can call the function");
          expect(await this.Proxy.executive()).to.equal(this.Executive.address)
        })
      })
      
      it("reverts on invalid action code", async function () {
        await expect(this.Proxy.executeAction(5, this.dev.address))
          .to.be.revertedWith("function was called with incorrect parameters");
      })
    })
  })
})
