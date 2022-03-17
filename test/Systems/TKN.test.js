// For all system tests, you need to test each action a policy or user can call to the system
// and make sure they have the intended side effects. You can group each call in a "describe"
// block that handles all the different cases of that call. Work directly with the docs to figure out how to test.
// Maybe write docs first? To map out the tests. And then write the code to run the tests?


const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber} = require("ethers");
const { ZERO_ADDRESS } = require("../utils.js");


describe("TKN.sol", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.user = this.signers[1];

    this.Proxy = await (await ethers.getContractFactory("Proxy")).deploy();
    await this.Proxy.deployed();

    this.Token = await (await ethers.getContractFactory("Token")).deploy(this.Proxy.address);
    await this.Token.deployed();

    this.TokenPolicy = await (await ethers.getContractFactory("TokenPolicy")).deploy(this.Proxy.address);
    await this.TokenPolicy.deployed();
 
    await this.Proxy.executeAction(0, this.Token.address);
    await this.Proxy.executeAction(2, this.TokenPolicy.address);
  })

  it("initializes state", async function () {
    expect(await this.Token.name()).to.equal("PROXY Token");
    expect(await this.Token.symbol()).to.equal("PROX");
    expect(await this.Token.decimals()).to.equal(3);

    expect(await this.Token.balanceOf(this.dev.address)).to.equal(0);
    expect(await this.Token.totalSupply()).to.equal(0);

    expect(await this.Token.allowance(this.dev.address, this.user.address)).to.equal( BigNumber.from(2).pow(256).sub(1) ); // (2**256) - 1
    expect(await this.Token.approve(this.user.address, 1000)).to.equal(true);
  })

  it("has functions that can only be called by Proxy Policies", async function() {
    await expect(this.Token.connect(this.user).mint(this.user.address, 1000)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.Token.connect(this.user).burn(this.user.address, 0)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.Token.connect(this.user).transfer(this.dev.address, 1000)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
    await expect(this.Token.connect(this.user).transferFrom(this.user.address, this.dev.address, 1000)).be.revertedWith("onlyPolicy(): only approved policies can call this function");
  })

  describe("mint()", function() {

    it("emits the 'Transfer' event", async function () {
      await expect(this.TokenPolicy.mint(this.user.address, 1000))
        .to.emit(this.Token, "Transfer")
        .withArgs(ZERO_ADDRESS, this.user.address, 1000);        
    })

    it("mints new tokens to target", async function() {
      await this.TokenPolicy.mint(this.user.address, 1000);
      expect(await this.Token.balanceOf(this.user.address)).to.equal(1000);

      await this.TokenPolicy.mint(this.user.address, 2000);
      expect(await this.Token.balanceOf(this.user.address)).to.equal(3000);
    })
  })


  describe("burn()", function() {

    beforeEach(async function () {
      await this.TokenPolicy.mint(this.user.address, 1000);
      expect(await this.Token.balanceOf(this.user.address)).to.equal(1000);
    })

    it("emits the 'Transfer' event", async function () {
      await expect(this.TokenPolicy.burn(this.user.address, 1000))
        .to.emit(this.Token, "Transfer")
        .withArgs(this.user.address, ZERO_ADDRESS,  1000);        
    })

    it("throws an error if it underflows", async function () {
      await expect(this.TokenPolicy.burn(this.user.address, 2000)).to.be.revertedWith("0x11");  // reverted with panic opcode (underflow error)  
    })

    it("burns tokens", async function() {
      await this.TokenPolicy.burn(this.user.address, 1000);

      expect(await this.Token.balanceOf(this.user.address)).to.equal(0);
    })

  })

  describe("transfer()", async function () {
    beforeEach(async function () {
      await this.TokenPolicy.mint(this.TokenPolicy.address, 5000);
    })

    it("emits the 'Transfer event", async function () {
      await expect(this.TokenPolicy.transfer(this.user.address, 3000))
      .to.emit(this.Token, "Transfer")
      .withArgs(this.TokenPolicy.address, this.user.address, 3000);
    })

    it("throws an error if the transfer exceeds a users balance", async function () {
      await expect(this.TokenPolicy.transfer(this.user.address, 6000)).to.be.revertedWith("0x11");
    })

    it("transfers token balance from caller", async function() {
      await this.TokenPolicy.transfer(this.user.address, 3000);

      expect (await this.Token.balanceOf(this.TokenPolicy.address)).to.equal(2000);
      expect (await this.Token.balanceOf(this.user.address)).to.equal(3000);
    })
  })  

  describe("transferFrom()", async function () {
    beforeEach(async function () {
      await this.TokenPolicy.mint(this.user.address, 5000);
      this.otherUser = this.signers[2];
    })

    it("emits the 'Transfer event", async function () {
      await expect(this.TokenPolicy.transferFrom(this.user.address, this.otherUser.address, 3000))
      .to.emit(this.Token, "Transfer")
      .withArgs(this.user.address, this.otherUser.address, 3000);
    })

    it("throws an error if the transfer exceeds a users balance", async function () {
      await expect(this.TokenPolicy.transferFrom(this.user.address, this.otherUser.address, 6000)).to.be.revertedWith("0x11");
    })

    it("transfers token balance from third party user", async function() {
      await this.TokenPolicy.transferFrom(this.user.address, this.otherUser.address, 3000);

      expect(await this.Token.balanceOf(this.user.address)).to.equal(2000);
      expect(await this.Token.balanceOf(this.otherUser.address)).to.equal(3000);
    })
  })

});
