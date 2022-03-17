module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { deployer } = namedAccounts;
  
  const proxy = await deployments.get("Proxy");


  const deployPrelaunchResult = await deploy("Prelaunch", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployPrelaunchResult.newlyDeployed) {
    log(
      `contract Prelaunch deployed at ${deployPrelaunchResult.address} with args ${deployPrelaunchResult.args} using ${deployPrelaunchResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Prelaunch at ${deployPrelaunchResult.address}` 
    )
  }

  const deployProxyDAOResult = await deploy("ProxyDAO", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployProxyDAOResult.newlyDeployed) {
    log(
      `contract ProxyDAO deployed at ${deployProxyDAOResult.address} with args ${deployProxyDAOResult.args} using ${deployProxyDAOResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract ProxyDAO at ${deployProxyDAOResult.address}` 
    )
  }

  const deployTokenSaleResult = await deploy("TokenSale", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployTokenSaleResult.newlyDeployed) {
    log(
      `contract Token Sale deployed at ${deployTokenSaleResult.address} with args ${deployTokenSaleResult.args} using ${deployTokenSaleResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Token Sale at ${deployTokenSaleResult.address}` 
    )
  }
};

const deployGovernanceResult = await deploy("Governance", {
  from: deployer,
  args: [proxy.address],
});
if (deployGovernanceResult.newlyDeployed) {
  log(
    `contract Governance deployed at ${deployGovernanceResult.address} with args ${deployGovernanceResult.args} using ${deployGovernanceResult.receipt.gasUsed} gas`
  );
} else {
  log(
    `using pre-existing contract Governance at ${deployGovernanceResult.address}` 
  )
}
};


module.exports.tags = ["Policies"];
module.exports.dependencies = ["Proxy"];