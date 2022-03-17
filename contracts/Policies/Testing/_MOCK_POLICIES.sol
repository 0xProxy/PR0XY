// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.11;

import "../../Proxy.sol";
import "../../Systems/EXC.sol";
import "../../Systems/REP.sol";
import "../../Systems/TKN.sol";
import "../../Systems/TSY.sol";
import "../../Systems/VTP.sol";

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";



contract InvalidSystem is System {

  constructor( Proxy proxy_) System(proxy_) {}

  function KEYCODE() external override pure returns (bytes3) { return "000"; }
}

contract InvalidSystem2 is System {

  constructor( Proxy proxy_) System(proxy_) {}

  function KEYCODE() external override pure returns (bytes3) { return "abc"; }
}


contract InvalidSystem3 is System {

  constructor( Proxy proxy_) System(proxy_) {}

  function KEYCODE() external override pure returns (bytes3) { return "AB"; }
}


contract TokenUpgraded is System, ERC20("Token Upgraded", "PROXv2") {
  constructor( Proxy proxy_) System(proxy_) {}

  function KEYCODE() external override pure returns (bytes3) { return "TKN"; }

  function mint(address to_, uint256 amt_) external returns(bool) {
    _mint(to_, amt_);
    return true;
  }

  function burn(address from_, uint256 amt_) external returns(bool) {
    _burn(from_, amt_);

    return true;
  }
}


contract ExecutivePolicy is Policy, Ownable {

  constructor( Proxy proxy_ ) Policy( proxy_ ) {}
  Executive private EXC;

  function configureSystems() external override{
    require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");
    EXC = Executive(requireSystem("EXC"));
  }

  function launchProxy() external onlyOwner {
    EXC.launchProxy();
  }


  function storeInstructions(Instruction[] calldata instructions) external onlyOwner {
   EXC.storeInstructions(instructions);
  }

  function executeInstructions(uint32 proposalId_) external onlyOwner {
    EXC.executeInstructions(proposalId_);
  }
}


contract ReputationPolicy is Policy {

  constructor( Proxy proxy_ ) Policy( proxy_ ) {}
  Reputation private REP;

  function configureSystems() external override{
    require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");
    REP = Reputation(requireSystem("REP"));
  }

  function registerWallet(address wallet_) external {
    REP.registerWallet(wallet_);    
  }

  function increaseBudget(bytes2 memberId_, uint256 amount_) external {
    REP.increaseBudget(memberId_, amount_);
  }
  

  function transferReputation(bytes2 from_, bytes2 to_, uint256 amount_) external {    
    REP.transferReputation(from_, to_, amount_);
  }


  function incrementUniqueReps(bytes2 memberId_) external {    
    REP.incrementUniqueReps(memberId_);
  }
}


contract TokenPolicy is Policy {

  constructor( Proxy proxy_ ) Policy( proxy_ ) {}
  Token private TKN;

  function configureSystems() external override{
    require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");
    TKN = Token(requireSystem("TKN"));
  }

  function mint(address to_, uint256 amount_) external {
    TKN.mint(to_, amount_);
  }

  function burn(address from_, uint256 amount_) external {
    TKN.burn(from_, amount_);
  }

  function transferFrom(address from_, address to_, uint256 amount_) external {
    TKN.transferFrom(from_, to_, amount_);
  }

  function transfer(address to_, uint256 amount_) external {
    TKN.transfer(to_, amount_);
  }
}


contract TreasuryPolicy is Policy {

  constructor( Proxy proxy_ ) Policy( proxy_ ) {}
  Treasury private TSY;

  function configureSystems() external override{
    require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");
    TSY = Treasury(requireSystem("TSY"));
  }

  function addTrackedAsset(address token_) external {
   TSY.addTrackedAsset(token_);
  }

  function processPayment(address from_, address token_, uint256 amount_) external {
   TSY.processPayment(from_, token_, amount_);
  }


  function withdrawFunds(address token_, uint256 amount_) external {
    TSY.withdrawFunds(token_, amount_);
  }
}

contract VotingPowerPolicy is Policy {

  constructor( Proxy proxy_ ) Policy( proxy_ ) {}
  VotingPower private VTP;

  function configureSystems() external override{
    require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");
    VTP = VotingPower(requireSystem("VTP"));
  }

  function rebase(uint256 basisPoints_) external {
    VTP.rebase(basisPoints_);
  }


  function issue(address to_, uint256 amount_) external {
    VTP.issue(to_, amount_);
  }


  function redeem(address from_, uint256 amount_) external {
   VTP.redeem(from_, amount_);
  }


  function resetVestingCredits(address wallet_) external {
    VTP.resetVestingCredits(wallet_);
  }


  function incrementVestingCredits(address wallet_) external {
    VTP.incrementVestingCredits(wallet_);
  }
}