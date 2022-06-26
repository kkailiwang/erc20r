// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./ERC721R.sol";

contract ExampleERC721R is ERC721R {
    //replace constructor arguments with your own
    constructor(
        uint256 totalSupply_,
        uint256 numReversibleBlocks,
        address governanceContract
    ) ERC721R("Test721R", "STAN721", numReversibleBlocks, governanceContract) {
        for (uint256 i=0; i<totalSupply_; i++){
            _mint(msg.sender, i);
        }
    }
}
