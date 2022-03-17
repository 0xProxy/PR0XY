// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../Proxy.sol';

contract Token is System, IERC20 {
  
  //////////////////////////////////////////////////////////////////////////////
  //                              SYSTEM CONFIG                               //
  //////////////////////////////////////////////////////////////////////////////

  // @NOTE consider making these constant, reduce read cost
  string public name = "PROXY Token";
  string public symbol = "PROX";
  uint8 public decimals = 3;

  uint256 public totalSupply = 0;
  // slot = sha3(1, address) -> balance
  mapping(address => uint256) public balanceOf;
  // slot 2 - length of thisArr
  // sha3(2) -> elements of thisArr
  bytes32[] public thisArr;
  uint public thisNum;

  constructor(Proxy proxy_) System(proxy_) {
  }

  function KEYCODE() external pure override returns (bytes3) { 
    return "TKN"; 
  }


  // brick the allowance features for the token (because transfers and transferFrom are restricted to a governance mechanism=)
  function allowance(address, address) external pure override returns (uint256) {
    return type(uint256).max;
  }

  function approve(address, uint256) external pure override returns (bool) {
    return true;
  }



  ////////////////////////////////////////////////////////////////////////////
  //                           POLICY INTERFACE                             //
  ////////////////////////////////////////////////////////////////////////////

  
  // event Transfer(address from, address to, uint256 amount); => already declared in the imported IERC20.sol


  // mint tokensToMint_, but only if the msg.sender has enough reserve tokens to exchange
  function mint(address to_, uint256 amount_) external onlyPolicy returns (bool) {

    totalSupply += amount_;

    // Cannot overflow because the sum of all user
    // balances can't exceed the max uint256 value.
    unchecked {
        balanceOf[to_] += amount_;
    }

    emit Transfer(address(0), to_, amount_);

    return true;
  }

  function burn(address from_, uint256 amount_) external onlyPolicy returns (bool) {
    
    balanceOf[from_] -= amount_;

    // Cannot underflow because a user's balance
    // will never be larger than the total supply.
    unchecked {
        totalSupply -= amount_;
    }

    emit Transfer(from_, address(0), amount_);

    return true;
  }


  // restrict 3rd party interactions with the token to approved policies.
  function transferFrom(address from_, address to_, uint256 amount_) public override onlyPolicy returns (bool) {
    balanceOf[from_] -= amount_;

    // Cannot overflow because the sum of all user
    // balances can't exceed the max uint256 value.
    unchecked {
        balanceOf[to_] += amount_;
    }

    emit Transfer(from_, to_, amount_);

    return true;
  }


  // restrict EOA transfers to approved policies.
  function transfer(address to_, uint256 amount_) public override onlyPolicy returns (bool) {
    balanceOf[msg.sender] -= amount_;

    // Cannot overflow because the sum of all user
    // balances can't exceed the max uint256 value.
    unchecked {
        balanceOf[to_] += amount_;
    }

    emit Transfer(msg.sender, to_, amount_);

    return true;
  }


}