// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../Proxy.sol";
import "../Systems/TKN.sol";
import "../Systems/REP.sol";
import "../Systems/VTP.sol";
import "../Systems/TSY.sol";

contract ProxyDAO is Policy {

  ///////////////////////////////////////////////////////////////////////////////////
  //                              PR0XY Proxy CONFIG                               //
  ///////////////////////////////////////////////////////////////////////////////////


  Token private TKN;
  VotingPower private VTP;
  Reputation private REP;
  Treasury private TSY;

  constructor( Proxy Proxy_ ) Policy( Proxy_ ) {}

  function configureSystems() external override {
    require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");

    TKN = Token(requireSystem("TKN"));
    VTP = VotingPower(requireSystem("VTP"));
    REP = Reputation(requireSystem("REP")); 
    TSY = Treasury(requireSystem("TSY"));
  }


  ///////////////////////////////////////////////////////////////////////////////////
  //                               POLICY VARIABLES                                //
  ///////////////////////////////////////////////////////////////////////////////////


  mapping(bytes2 => mapping(bytes2 => uint256)) public repsGiven;


  ///////////////////////////////////////////////////////////////////////////////////
  //                                 USER ACTIONS                                  //
  ///////////////////////////////////////////////////////////////////////////////////


  // Register for a Proxy ID
  function register(address pmtCurrency_) external {   
    require(_proxy.currentEpoch() != 0, "cannot register(): Proxy has not launched yet!");

    // assign Id to wallet in the registry
    REP.registerWallet(msg.sender);

    // get the decimals of the token 
    uint8 decimals = IERC20Metadata(pmtCurrency_).decimals();
    
    // book the payment to the treasury
    TSY.processPayment(msg.sender, pmtCurrency_, 5 * (10 ** decimals));
  }

  // Give reputation to a Proxy Id
  function giveReputation(bytes2 toMemberId_, uint256 amount_) external {

    bytes2 fromMemberId = REP.getId(msg.sender);
    uint256 prevRepsGiven = repsGiven[fromMemberId][toMemberId_];
    uint256 newRepsGiven = prevRepsGiven + amount_;

    require(fromMemberId != bytes2(0), "cannot giveReputation(): caller does not have registered wallet" );
    require(REP.walletOfId(toMemberId_) != address(0), "cannot giveReputation(): receiving ID must be associated with a registered wallet" );
    require(toMemberId_ != fromMemberId, "cannot giveReputation(): caller cannot give themselves reputation" );
    require(newRepsGiven <= 1000, "cannot giveReputation(): cannot exceed 1000 reputation given per member" );

    REP.transferReputation(fromMemberId, toMemberId_, amount_);
    repsGiven[fromMemberId][toMemberId_] = newRepsGiven;

    // increment the member's unique reputations if this is your the first time giving them reputation
    if (prevRepsGiven < 500 && newRepsGiven >= 500) {
      REP.incrementUniqueReps(toMemberId_);
    }

    // give the member a 100 rep bonus (50%) if the giver is capping their reputation
    if (prevRepsGiven < 1000 && newRepsGiven == 1000 ) {
      REP.increaseBudget(bytes2(0), 500);
      REP.transferReputation(bytes2(0), toMemberId_, 500);
    }

  }


  // Lock PROX for 15 vesting terms, get gPROX (Votes) and Reputation Budget in return.
  function lockTokens(uint256 amount_) external {
    bytes2 fromMemberId = REP.getId(msg.sender);

    require(fromMemberId != bytes2(0), "cannot lockTokens(): caller does not have a registered proxy Id");

    TKN.burn(msg.sender, amount_);
    VTP.resetVestingCredits(msg.sender);
    VTP.issue(msg.sender, amount_);
    REP.increaseBudget(fromMemberId, amount_ / 1000);
  }


  // At 15 vesting terms or more, exchange gPROX (Votes) for PROX tokens.
  function redeemVotes( uint256 amount_) external {
    require(VTP.vestingCreditsOf(msg.sender) >= 15, "cannot redeemVotes(): caller doesn't have enough vesting credits");
    VTP.resetVestingCredits(msg.sender);

    uint256 baseAmt = VTP.redeem(msg.sender, amount_);
    uint256 index = VTP.currentIndex() / 1e6;
    TKN.mint(msg.sender, baseAmt * index);
  }
}
