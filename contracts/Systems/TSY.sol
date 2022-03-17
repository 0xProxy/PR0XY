// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '../Proxy.sol';
import 'hardhat/console.sol';

contract Treasury is System {


  //////////////////////////////////////////////////////////////////////////////
  //                              SYSTEM CONFIG                               //
  //////////////////////////////////////////////////////////////////////////////


  constructor(Proxy proxy_) System(proxy_) {}
  
  function KEYCODE() external pure override returns (bytes3) { return "TSY"; }

  mapping(address => bool) public trackedAsset;

  mapping(address => uint256) public totalInflowsForAsset;
  mapping(address => uint256) public totalOutflowsForAsset;

  mapping(uint256 => mapping(address => uint256)) public assetInflowsPerEpoch;
  mapping(uint256 => mapping(address => uint256)) public assetOutflowsPerEpoch;


  ////////////////////////////////////////////////////////////////////////////
  //                           POLICY INTERFACE                             //
  ////////////////////////////////////////////////////////////////////////////
  
  
  event AssetAdded(address token);
  event PaymentProcessed(address from, address token, uint256 amount);
  event FundsWithdrawn(address token, uint256 amount);


  function addTrackedAsset(address token_) external onlyPolicy {
    trackedAsset[token_] = true;

    emit AssetAdded(token_);
  }


  function processPayment(address from_, address token_, uint256 amount_) external onlyPolicy {
    require(trackedAsset[token_] == true, "cannot processPayment(): token is not an accepted currency by the treasury");
    
    IERC20(token_).transferFrom(from_, address(this), amount_);

    uint256 epoch = _proxy.currentEpoch();
    totalInflowsForAsset[token_] += amount_;
    assetInflowsPerEpoch[epoch][token_] += amount_;

    emit PaymentProcessed(from_, token_, amount_);
  }


  function withdrawFunds(address token_, uint256 amount_) external onlyPolicy {
    require(trackedAsset[token_] == true, "cannot withdrawFunds(): token is not an accepted currency by the treasury");

    IERC20(token_).transfer(msg.sender, amount_);

    uint256 epoch = _proxy.currentEpoch();
    totalOutflowsForAsset[token_] += amount_;
    assetOutflowsPerEpoch[epoch][token_] += amount_;

    emit FundsWithdrawn(token_, amount_);
  }
}