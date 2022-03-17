// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.10;

// Presale Policy

// SPDX License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.10;


import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '../Proxy.sol';
import '../Systems/REP.sol';
import '../Systems/TKN.sol';
import '../Systems/TSY.sol';
import '../Systems/VTP.sol';


contract TokenSale is Policy { 

  constructor(Proxy Proxy_) Policy(Proxy_) {}


  Token private TKN;
  Treasury private TSY;
  Reputation private REP;


  function configureSystems() external override {
      require(msg.sender == address(_proxy), "cannot configureSystems(): only the Proxy contract can configure systems");

      TKN = Token(requireSystem("TKN"));
      REP = Reputation(requireSystem("REP")); 
      TSY = Treasury(requireSystem("TSY"));

      TSY.addTrackedAsset(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174); // USDC
      TSY.addTrackedAsset(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063); // DAI
      TSY.addTrackedAsset(0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89); // FRAX
    }

  ///////////////////////////////////////////////////////////////////////////////////
  //                                  POLICY STATE                                 //
  ///////////////////////////////////////////////////////////////////////////////////


  mapping(uint256 => mapping(address => uint256)) purchaseHistory;


  ///////////////////////////////////////////////////////////////////////////////////
  //                                    ACTIONS                                    //
  ///////////////////////////////////////////////////////////////////////////////////

  // ********************************************************************************
  //
  //                               Purchase Presale Token
  //                              ------------------------  
  //
  //    Purchase PROX tokens for 5 FRAX or DAI
  // 
  //    NOTE: Make sure you approve the necessary DAI first to purchase!
  //      See details: www.notion.so/ProxyProtocol/Trial-By-Proxy/Instructions/Presale.md
  //
  //    NOTE: PROXY has 3 decimals, so add three zeros to your purchase amount 
  //      e.g. If you want to buy 5 aPROXY, set amount_ = 5;
  //
  // ********************************************************************************


  function purchase(uint16 amount_, address pmtCurrency_) external {       

    uint256 currentEpoch = _proxy.currentEpoch();
    uint256 alreadyPurchased = purchaseHistory[currentEpoch][msg.sender];
    uint256 paymentValue = 1 * amount_ * (10**IERC20Metadata(pmtCurrency_).decimals()) / 100;

    require(alreadyPurchased + amount_ <= _getAllocationOf(msg.sender), "cannot purchaseToken(): not enough token sale allocation");     

    purchaseHistory[_proxy.currentEpoch()][msg.sender] = alreadyPurchased + amount_;

    TSY.processPayment(msg.sender, pmtCurrency_, paymentValue);
    TKN.mint(msg.sender, amount_ * 1000);
  }


  function viewMyAllocation() external view returns(uint256) {       
    return _getAllocationOf(msg.sender);
  }


  // Internal Functions

  function _getAllocationOf(address wallet_) internal view returns (uint256) {
    
    bytes2 proxyId = REP.getId(wallet_);
    uint256 reputationAlloc = uint256(REP.scoreOfId(proxyId) / 4);
    uint256 uniqueRepsAlloc = uint256(REP.uniqueRepsOfId(proxyId) * 375);

    require(proxyId != bytes2(0), "cannot find getAllocationOf(): caller is not a registered wallet");

    if (reputationAlloc <= uniqueRepsAlloc && reputationAlloc < 5000) {
      return reputationAlloc;
    } else if (uniqueRepsAlloc < reputationAlloc && uniqueRepsAlloc < 5000) {
      return uniqueRepsAlloc;
    } else {
      return 5000;
    }
  }
}