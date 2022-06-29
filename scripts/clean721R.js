//example script scraping all of the transaction data that must be cleaned for a given block era. 

const { ethers } = require("hardhat");

const clean = async (ethersContract, currblock) => {
    const findTokenIdsToClean = async () => {
        const numReversibleBlocks = await ethersContract.NUM_REVERSIBLE_BLOCKS();
        const transfers = await ethersContract.queryFilter('Transfer', 0, currblock - numReversibleBlocks );
        return Array(...new Set(transfers.map(transfer => transfer.args.tokenId)));
    }

    const cleanBlocks = async () => {
        const tokenIDs = await findTokenIdsToClean();

        console.log(tokenIDs);
        await ethersContract.clean(tokenIDs);
    }
    await cleanBlocks();
}
module.exports = { clean }