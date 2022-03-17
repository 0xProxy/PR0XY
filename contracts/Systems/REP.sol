// Proxy Registry System


// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.11;

import "../Proxy.sol";

contract Reputation is System {


  /////////////////////////////////////////////////////////////////////////////////
  //                           Proxy Proxy Configuration                         //
  /////////////////////////////////////////////////////////////////////////////////


  constructor(Proxy proxy_) System(proxy_) {}


  function KEYCODE() external pure override returns (bytes3) { 
    return "REP"; 
  }


  /////////////////////////////////////////////////////////////////////////////////
  //                              System Variables                               //
  /////////////////////////////////////////////////////////////////////////////////


  mapping(address => bytes2) public getId;
  mapping(bytes2 => address) public walletOfId;
  
  mapping(bytes2 => uint256) public budgetOfId;
  mapping(bytes2 => uint256) public scoreOfId;
  mapping(bytes2 => uint256) public uniqueRepsOfId;

  mapping(bytes2 => mapping(bytes2 => uint256)) public totalGivenTo;


  /////////////////////////////////////////////////////////////////////////////////
  //                             Functions                                       //
  /////////////////////////////////////////////////////////////////////////////////


  event WalletRegistered(address wallet, bytes2 memberId);
  event BudgetIncreased(bytes2 memberId, uint256 amount);
  event ReputationGiven(bytes2 fromMemberId, bytes2 toMemberId, uint256 amount);
  event ReputationTransferred(bytes2 fromMemberId, bytes2 toMemberId, uint256 amount);
  event UniqueRepsIncremented(bytes2 fromMemberId);


  // @@@ Check that the bytes2 hash cannot be bytes2(0)
  function registerWallet(address wallet_) external onlyPolicy returns (bytes2) {
    // validate: wallets cannot be registered twice. (just manually test this first)
    require( getId[wallet_] == bytes2(0), "cannot registerWallet(): wallet already registered" );

    // 1. Take the first two bytes (4 hex characters) of a hash of the wallet
    bytes32 walletHash = keccak256(abi.encode(wallet_));
    bytes2 memberId = bytes2(walletHash);

    // 2. If the memberId already exists (or is 0x0000), continue hashing until a unused memberId is found
    while (walletOfId[memberId] != address(0) || memberId == bytes2(0)) {
      walletHash = keccak256(abi.encode(walletHash));
      memberId = bytes2(walletHash);
    }

    // 3. Save the id in the system
    getId[wallet_] = memberId;
    walletOfId[memberId] = wallet_;

    // 4. emit event
    emit WalletRegistered(wallet_, memberId);

    // 5. Return the user IIdd
    return memberId;
  }


  //
  function increaseBudget(bytes2 memberId_, uint256 amount_) external onlyPolicy {
    //
    budgetOfId[memberId_] += amount_;

    emit BudgetIncreased(memberId_, amount_);
  }
  

  function transferReputation(bytes2 from_, bytes2 to_, uint256 amount_) external onlyPolicy {    
    budgetOfId[ from_ ] -= amount_;
    scoreOfId[ to_ ] += amount_;

    emit ReputationTransferred(from_, to_, amount_);
  }


  function incrementUniqueReps(bytes2 memberId_) external onlyPolicy {    
    uniqueRepsOfId[ memberId_ ]++;

    emit UniqueRepsIncremented( memberId_ );
  }
}
