const { BigNumber, ethers } = require("ethers");

async function incrementWeek(customTime) {
  const time = customTime ? customTime : 7 * 24 * 60 * 60;

  const blockNumBefore = await hre.ethers.provider.getBlockNumber();
  const blockBefore = await hre.ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;

  await hre.ethers.provider.send('evm_setNextBlockTimestamp', [timestampBefore + time])
  await hre.ethers.provider.send('evm_mine');
}

function systemKeycode(string) {
  const bytes32 = ethers.utils.formatBytes32String(string);
  return ethers.utils.hexDataSlice(bytes32, 0, 3);
}

// Defaults to e18 using amount * 10^18
function getBigNumber(amount, decimals = 18) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals))
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

module.exports = {
  incrementWeek,
  systemKeycode,
  getBigNumber,
  ZERO_ADDRESS,
}