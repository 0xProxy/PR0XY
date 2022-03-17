module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { deployer } = namedAccounts;
  
  const proxy = await deployments.get("Proxy");


  const deployExecutiveResult = await deploy("Executive", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployExecutiveResult.newlyDeployed) {
    log(
      `contract Executive deployed at ${deployExecutiveResult.address} with args ${deployExecutiveResult.args} using ${deployExecutiveResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Executive at ${deployExecutiveResult.address}` 
    )
  }


  const deployEXEPolicyResult = await deploy("ExecutivePolicy", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployEXEPolicyResult.newlyDeployed) {
    log(
      `contract Executive Policy (Bootstrapper) deployed at ${deployEXEPolicyResult.address} with args ${deployEXEPolicyResult.args} using ${deployEXEPolicyResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Executive Policy (Bootsrapper) at ${deployEXEPolicyResult.address}` 
    )
  }


  const deployReputationResult = await deploy("Reputation", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployReputationResult.newlyDeployed) {
    log(
      `contract Reputation deployed at ${deployReputationResult.address} with args ${deployReputationResult.args} using ${deployReputationResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Reputation at ${deployReputationResult.address}` 
    )
  }

  const deployTokenResult = await deploy("Token", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployTokenResult.newlyDeployed) {
    log(
      `contract Token deployed at ${deployTokenResult.address} with args ${deployTokenResult.args} using ${deployTokenResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Token at ${deployTokenResult.address}` 
    )
  }

  const deployTreasuryResult = await deploy("Treasury", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployTreasuryResult.newlyDeployed) {
    log(
      `contract Treasury deployed at ${deployTreasuryResult.address} with args ${deployTreasuryResult.args} using ${deployTreasuryResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract Treasury at ${deployTreasuryResult.address}` 
    )
  }

  const deployVotingPowerResult = await deploy("VotingPower", {
    from: deployer,
    args: [proxy.address],
  });
  if (deployVotingPowerResult.newlyDeployed) {
    log(
      `contract VotingPower deployed at ${deployVotingPowerResult.address} with args ${deployVotingPowerResult.args} using ${deployVotingPowerResult.receipt.gasUsed} gas`
    );
  } else {
    log(
      `using pre-existing contract VotingPower at ${deployVotingPowerResult.address}` 
    )
  }
};

module.exports.tags = ["Systems"];
module.exports.dependencies = ["Proxy"];