// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./ERC20R.sol";

contract ExampleERC20R is ERC20R {
    //6-12 hours is the reversible time period

    //replace constructor arguments with your own
    constructor(uint256 totalSupply_)
        ERC20R("Test", "STAN", 2160, 0xf4960B3bf418E0B33E3805d611DD4EDdDB5b43B0)
    {
        _mint(msg.sender, totalSupply_);
    }
}
