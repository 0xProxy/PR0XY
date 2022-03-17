// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.10;

// import "openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Proxy.sol";
import "../Systems/TKN.sol";
import "../Systems/EXC.sol";
import "../Systems/REP.sol";

contract Prelaunch is Policy {

  ///////////////////////////////////////////////////////////////////////////////////
  //                                 PROTOCOL CONFIG                               //
  ///////////////////////////////////////////////////////////////////////////////////


  address private _dev;

  constructor( Proxy proxy_ ) Policy( proxy_ ) {
    _dev = msg.sender;
  }
  

  Reputation private REP;
  Executive private EXC;
  Token private TKN;


  function configureSystems() external override{
    require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");
    REP = Reputation(requireSystem("REP"));
    EXC = Executive(requireSystem("EXC"));
    TKN = Token(requireSystem("TKN"));
  }



  ///////////////////////////////////////////////////////////////////////////////////
  //                               POLICY VARIABLES                                //
  ///////////////////////////////////////////////////////////////////////////////////



  address[] public claimAddresses;
  mapping(bytes2 => bool) public isClaimed;

  mapping(address => bool) public isApproved;


  // functions with this modifier can only be called before the project is launched
  // Learn More: www.notion.so/pr0xy-prelaunch-phase
  modifier prelaunchOnly() {

    // ensure that this function can only be called before the first epoch
    require ( _proxy.currentEpoch() == 0, "prelaunchOnly() failed: Proxy has already been launched" );
    _;
  }


  ///////////////////////////////////////////////////////////////////////////////////
  //                                 USER INTERFACE                                //
  ///////////////////////////////////////////////////////////////////////////////////


  event LaunchBonusClaimed(bytes2 memberId, uint256 slot);



  // whitelists an address to register before the project launches
  function approvePreregistrationFor( address newMember_ ) external prelaunchOnly {
    require ( msg.sender == _dev, "prelaunchOnly() failed: caller is not the dev" );

    // toggle whitelist
    isApproved[ newMember_ ] = true;
  }


  // Register for a Proxy ID
  function preregister() external prelaunchOnly {
    // only preapproved addresses can register before project launches.
    // For more details, visit: www.notion.so/pr0xy-tapped
    require ( isApproved[ msg.sender ], "cannot register() during prelaunch: member is not preapproved" );
    
    // assign Id to wallet in the registry
    bytes2 memberId = REP.registerWallet( msg.sender );

    // seed the address with 100 reputation budget
    REP.increaseBudget( memberId, 500 );
  }

  //
  function claimLaunchBonus() external prelaunchOnly {
    bytes2 memberId = REP.getId(msg.sender);

    require(memberId != bytes2(0), "cannot claimLaunchBonus(): caller does not have a Proxy ID");
    require(isClaimed[memberId] == false, "cannot claimLaunchSlot(): member has already claimed a slot");
    require(REP.scoreOfId(memberId) >= 500, "cannot claimLaunchSlot(): member does not have the required reputation score");
    require(REP.uniqueRepsOfId(memberId) >= 3, "cannot claimLaunchSlot(): member does not have the required uniqueReps");
    require(_proxy.isLaunched() == false, "cannot claimLaunchSlot(): project has already been launched");

    claimAddresses.push(msg.sender);
    isClaimed[memberId] = true;

    if ( claimAddresses.length >= 3 ) {
      for ( uint i = 0; i < 3; i++ ) {
        TKN.mint( claimAddresses[i], 200e3 ); // mint each bonus reservation 200 PROX
      }

      EXC.launchProxy();
    }

    emit LaunchBonusClaimed(memberId, claimAddresses.length);
  }
}