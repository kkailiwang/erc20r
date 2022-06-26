// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./ERC20R.sol";

contract ExampleERC20R is ERC20R {
    //replace constructor arguments with your own
    constructor(
        uint256 totalSupply_,
        uint256 numReversibleBlocks,
        address governanceContract
    ) ERC20R("Test", "STAN", numReversibleBlocks, governanceContract) {
        _mint(msg.sender, totalSupply_);
    }
}
