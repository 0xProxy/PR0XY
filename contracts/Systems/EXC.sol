// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.11;
// EXE is the execution engine for the OS.

import "../Proxy.sol";

contract Executive is System {


  /////////////////////////////////////////////////////////////////////////////////
  //                           Proxy Proxy Configuration                         //
  /////////////////////////////////////////////////////////////////////////////////


  constructor(Proxy proxy_) System(proxy_) {
    // instructionsForId[0];
  }

  function KEYCODE() external pure override returns (bytes3) { return "EXC"; }


  /////////////////////////////////////////////////////////////////////////////////
  //                              System Variables                               //
  /////////////////////////////////////////////////////////////////////////////////


  /* imported from Proxy.sol

  enum Actions {
    ChangeExecutive,
    ApprovePolicy,
    TerminatePolicy,
    InstallSystem,
    UpgradeSystem
  }

  struct Instruction {
    Actions action;
    address target;
  }

  */

  uint256 public totalInstructions;
  mapping(uint256 => Instruction[]) public storedInstructions;


  /////////////////////////////////////////////////////////////////////////////////
  //                             Policy Interface                                //
  /////////////////////////////////////////////////////////////////////////////////


  event ProxyLaunched(uint256 timestamp);
  event InstructionsStored(uint256 instructionsId);
  event InstructionsExecuted(uint256 instructionsId);


  function launchProxy() external onlyPolicy {
    _proxy.launch();

    emit ProxyLaunched(block.timestamp);
  }


  function storeInstructions(Instruction[] calldata instructions_) external onlyPolicy returns(uint256) {
    uint256 instructionsId = totalInstructions + 1;
    Instruction[] storage instructions = storedInstructions[instructionsId];

    require(instructions_.length > 0, "cannot storeInstructions(): instructions cannot be empty");

    // @TODO use u256
    for(uint i=0; i<instructions_.length; i++) { 
      _ensureContract(instructions_[i].target);
      if (instructions_[i].action == Actions.InstallSystem || instructions_[i].action == Actions.UpgradeSystem) {
        bytes3 keycode = System(instructions_[i].target).KEYCODE();
        _ensureValidKeycode(keycode);
        if (keycode == "EXC") {
          require(instructions_[instructions_.length-1].action == Actions.ChangeExecutive, 
                  "cannot storeInstructions(): changes to the Executive system (EXC) requires changing the Proxy executive as the last step of the proposal");
          require(instructions_[instructions_.length-1].target == instructions_[i].target,
                  "cannot storeInstructions(): changeExecutive target address does not match the upgraded Executive system address");
        }
      }
      instructions.push(instructions_[i]);
    }
    totalInstructions++;

    emit InstructionsStored(instructionsId);

    return instructionsId;
  }

  function executeInstructions(uint256 instructionsId_) external onlyPolicy {
    Instruction[] storage proposal = storedInstructions[instructionsId_];

    require(proposal.length > 0, "cannot executeInstructions(): proposal does not exist");

    for(uint step=0; step<proposal.length; step++) {
      _proxy.executeAction(proposal[step].action, proposal[step].target);
    }

    emit InstructionsExecuted(instructionsId_);
  }
  

  /////////////////////////////// INTERNAL FUNCTIONS ////////////////////////////////


  function _ensureContract(address target_) internal view {
    uint256 size;
    assembly { size := extcodesize(target_) }
    require(size > 0, "cannot storeInstructions(): target address is not a contract");
  }


  function _ensureValidKeycode(bytes3 keycode) internal pure {
    for (uint256 i = 0; i < 3; i++) {
        bytes1 char = keycode[i];
        require(char >= 0x41 && char <= 0x5A, " cannot storeInstructions(): invalid keycode"); // A-Z only"
    }
  }
}