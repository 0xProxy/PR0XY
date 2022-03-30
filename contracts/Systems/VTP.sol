// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../Proxy.sol';

contract VotingPower is System, IERC20 {
  

  //////////////////////////////////////////////////////////////////////////////
  //                              SYSTEM CONFIG                               //
  //////////////////////////////////////////////////////////////////////////////


  constructor(Proxy proxy_) System(proxy_) {}

  function KEYCODE() external pure override returns (bytes3) { return "VTP"; }

  function balanceOf(address wallet_) public view override returns (uint256) {
    return _baseBalanceOf[wallet_] * currentIndex / 1e6;
  }

  function totalSupply() public view override returns (uint256) {
    return _totalBaseSupply * currentIndex / 1e6;
  }

  // brick the allowance features for the token
  function allowance(address, address) external pure override returns (uint256) {
    return type(uint256).max;
  }

  function approve(address, uint256) external pure override returns (bool) {
    return true;
  }

  // disable transfer of tokens from wallets. Voting power is directly issued to address and stays there until redemption.
  function transferFrom(address, address, uint256) external pure override returns(bool) {
    assert(false);
    return true;
  }

  // restrict EOA transfers.
  function transfer(address, uint256) public pure override returns (bool) {
    assert(false);
    return true;
  }


  /////////////////////////////////////////////////////////////////////////////////
  //                              System Variables                               //
  /////////////////////////////////////////////////////////////////////////////////


  string public name = "PR0XY Voting Power";
  string public symbol = "vePROX";
  uint8 public decimals = 3;

  uint256 public currentIndex = 1e6; // rebase multiplier on base, with 6 decimals of precision
  uint256 private _totalBaseSupply = 0;
  mapping(address => uint256) private _baseBalanceOf;
  
  uint16 public vestingTerm = 15;
  mapping(address => uint16) public vestingCreditsOf;


  ////////////////////////////////////////////////////////////////////////////
  //                           POLICY INTERFACE                             //
  ////////////////////////////////////////////////////////////////////////////


  // event Transfer(address from, address to, uint256 amount) => declared in the imported IERC20.sol
  event Rebased(uint256 basisPoints);
  event VestingCreditsIncremented(address wallet);
  event VestingCreditsReset(address wallet);


  function rebase(uint256 basisPoints_) external onlyPolicy {
    currentIndex = currentIndex * (10000 + basisPoints_) / 1e4;

    emit Rebased(basisPoints_);
  }


  function issue(address to_, uint256 amount_) external onlyPolicy returns (uint256) {
    uint256 baseAmt = amount_ * (1e6) / currentIndex;

    vestingCreditsOf[msg.sender] = 0;
    _totalBaseSupply += baseAmt;
    _baseBalanceOf[to_] += baseAmt;

    emit Transfer(address(0), to_, amount_);

    return baseAmt;
  }


  function redeem(address from_, uint256 amount_) external onlyPolicy returns(uint256) {
    uint256 baseAmt = amount_ * 1e6 / currentIndex;

    vestingCreditsOf[msg.sender] = 0;
    _baseBalanceOf[from_] -= baseAmt;
    _totalBaseSupply -= baseAmt;

    emit Transfer(from_, address(0), amount_);

    return baseAmt;
  }


  function resetVestingCredits(address wallet_) external onlyPolicy {
    vestingCreditsOf[wallet_] = 0;

    emit VestingCreditsReset(wallet_);
  }


  function incrementVestingCredits(address wallet_) external onlyPolicy {
    vestingCreditsOf[wallet_]++;

    emit VestingCreditsIncremented(wallet_);
  }
}