// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {CreditMarket} from "../contracts/CreditMarket.sol";

interface VmDeploy {
    function envUint(string calldata key) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    VmDeploy private constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    event ContractsDeployed(address indexed creditMarket, address indexed eligibilitySigner);

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 signerKey = vm.envUint("ELIGIBILITY_SIGNER_PRIVATE_KEY");
        address signer = vm.addr(signerKey);

        vm.startBroadcast(deployerKey);
        CreditMarket market = new CreditMarket(signer);
        vm.stopBroadcast();

        emit ContractsDeployed(address(market), signer);
    }
}
