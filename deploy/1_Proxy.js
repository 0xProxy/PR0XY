module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { deployer } = namedAccounts;

  const deployProxyResult = await deploy("Proxy", {
    from: deployer,
    args: [],
  });
  if (deployProxyResult.newlyDeployed) {
    log(
      `contract Proxy deployed at ${deployProxyResult.address} using ${deployProxyResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Proxy at ${deployProxyResult.address}` 
    )
  }
};
module.exports.tags = ["Proxy"];