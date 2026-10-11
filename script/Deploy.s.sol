// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";
import {CreditMarket} from "../contracts/CreditMarket.sol";

interface VmDeploy {
    function envUint(string calldata key) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    VmDeploy private constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    event ContractsDeployed(address indexed mockUSDC, address indexed creditMarket, address indexed eligibilitySigner);

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 signerKey = vm.envUint("ELIGIBILITY_SIGNER_PRIVATE_KEY");
        address signer = vm.addr(signerKey);

        vm.startBroadcast(deployerKey);
        MockUSDC token = new MockUSDC();
        CreditMarket market = new CreditMarket(IERC20(address(token)), signer);
        vm.stopBroadcast();

        emit ContractsDeployed(address(token), address(market), signer);
    }
}
