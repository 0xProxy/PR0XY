// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.11;

import '../Proxy.sol';
import '../Systems/EXC.sol';
import '../Systems/REP.sol';
import '../Systems/TKN.sol';
import '../Systems/TSY.sol';
import '../Systems/VTP.sol';


contract Governance is Policy {

  Executive private EXC;
  Token private TKN;
  Treasury private TSY;
  Reputation private REP;
  VotingPower private VTP;

  constructor(Proxy proxy_) Policy(proxy_) {
    EXC = Executive(requireSystem("EXC"));
    TKN = Token(requireSystem("TKN"));
    TSY = Treasury(requireSystem("TSY")); 
    REP = Reputation(requireSystem("REP"));
    VTP = VotingPower(requireSystem("VTP")); 
  }


  ///////////////////////////////////////////////////////////////////////////////////
  //                               POLICY VARIABLES                                //
  ///////////////////////////////////////////////////////////////////////////////////


  struct Proposal {
    bytes32 name; // name of the proposal—human readable reference.
    uint256 instructionsId; // reference of the instruction set saved in the executive system.
    address proposer; // address of the wallet sending the proposal
    bytes2[] coauthors; // Ids of all the coauthors of the proposal (get equal split of the bounty reward) 
  }

  struct StagedProposal {
    uint256 instructionsId;
    uint256 epochStaged;
  }

  StagedProposal public stagedProposal;
  mapping( uint256 => bool) public proposalHasStaged;

  mapping( uint256 => Proposal ) public proposalForInstructionsId;
  
  mapping( uint256 => uint256 ) public endorsementsForProposal;
  mapping( address => mapping( uint256 => uint256 )) public userEndorsementsForProposal;

  mapping( uint256 => int256 ) public netVotesForProposal;
  mapping( address => mapping( uint256 => int256 )) public userNetVotesForProposal;


  ///////////////////////////////////////////////////////////////////////////////////
  //                                USER INTERFACE                                 //
  ///////////////////////////////////////////////////////////////////////////////////


  // submit a new Proposal to the System
  function submitProposal(bytes32 proposalName_, Instruction[] calldata instructions_, bytes2[] calldata coauthors_) external {
    bytes2 proposerId = REP.getId(msg.sender);

    require(REP.uniqueRepsOfId(proposerId) >= 5, "cannot submitProposal(): caller needs at least 5 unique reps to submit proposal");
    require(coauthors_.length > 0, "cannot submitProposal(): there needs to be at least one author of the proposal");
    for (uint256 i=0; i<coauthors_.length; i++) {
      require(REP.scoreOfId(coauthors_[i]) > 1500, "cannot submitProposal(): coauthors must have greater than 1500 reputation");
    }

    uint256 instructionsId = EXC.storeInstructions(instructions_);
    proposalForInstructionsId[instructionsId] = Proposal(proposalName_, instructionsId, msg.sender, coauthors_);
  }


  // signal for a Proposal to be activated for a vote
  function endorseProposal(uint256 instructionsId_) external {
    uint256 userEndorsements = VTP.balanceOf(msg.sender);
    uint256 previousEndorsements = userEndorsementsForProposal[msg.sender][instructionsId_];

    require( userEndorsements > previousEndorsements, "cannot endorseProposal(): user doesn't have enough voting power to endorse proposal");
             
    userEndorsementsForProposal[msg.sender][instructionsId_] = userEndorsements;
    endorsementsForProposal[instructionsId_] -= previousEndorsements;
    endorsementsForProposal[instructionsId_] += userEndorsements;
  }


  function stageProposal(uint256 instructionsId_) external {
    uint256 currentEpoch = _proxy.currentEpoch();

    require(msg.sender == proposalForInstructionsId[instructionsId_].proposer, "cannot stageProposal(): only the original proposer can stage it for a vote");
    require(endorsementsForProposal[instructionsId_] > VTP.totalSupply() / 5, "cannot stageProposal(): proposal needs at least 1/5 of max endorsements to be staged");
    require(proposalHasStaged[instructionsId_] == false, "cannot stageProposal(): proposal has already been staged before");
    require(currentEpoch >= stagedProposal.epochStaged + 2, "cannot stageProposal(): currently staged proposal has not expired");

    proposalHasStaged[instructionsId_] = true;
    stagedProposal = StagedProposal(instructionsId_, currentEpoch);
  }


  function vote(bool vote_) external {
    uint256 userVotes = VTP.balanceOf( msg.sender );
    int256 userNetVotes = vote_ ? int256(userVotes) : int256(-1) * int256(userVotes);

    require (userNetVotesForProposal[msg.sender][stagedProposal.instructionsId] == 0, "cannot voteOnStagedProposal(): user can only vote once");
    
    userNetVotesForProposal[msg.sender][stagedProposal.instructionsId] = userNetVotes;
    netVotesForProposal[stagedProposal.instructionsId] += userNetVotes;

    if ( netVotesForProposal[stagedProposal.instructionsId] > int256(VTP.totalSupply() * 4 / 10 )) {
      bytes2[] memory coauthors = proposalForInstructionsId[stagedProposal.instructionsId].coauthors;
      uint256 rewardAmt = (VTP.totalSupply() * 2 / 100) / coauthors.length;

      for (uint i=0; i<coauthors.length; i++) {
        address wallet = REP.walletOfId(coauthors[i]);
        TKN.mint(wallet, rewardAmt);
        VTP.resetVestingCredits(wallet);
      }

      VTP.rebase(500);
      EXC.executeInstructions(stagedProposal.instructionsId);
      stagedProposal = StagedProposal(uint256(0), uint256(0));
    } 
    
    else if (netVotesForProposal[stagedProposal.instructionsId] < int256(VTP.totalSupply()) * -3 / 10 ) {
      VTP.rebase(500);
      stagedProposal = StagedProposal(uint256(0), uint256(0));
    }
  }
}