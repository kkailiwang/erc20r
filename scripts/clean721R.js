//example script scraping all of the transaction data that must be cleaned for a given block era. 

const { ethers } = require("hardhat");

const clean = async (ethersContract, currblock) => {
    const findTokenIdsToClean = async () => {
        const numReversibleBlocks = await ethersContract.NUM_REVERSIBLE_BLOCKS();
        const transfers = await ethersContract.queryFilter('Transfer', 0, currblock - numReversibleBlocks );
        const longerThan1 = async (tokenId) => {
            console.log(tokenId, await ethersContract.owningGetLength(tokenId)>1);
            return await ethersContract.owningGetLength(tokenId)>1;
        }
        const unfilteredIds = Array(...new Set(transfers.map(transfer => transfer.args.tokenId)));
        let filteredIds = [];
        for (let i=0; i < unfilteredIds.length; i++){
            if ((await ethersContract.owningGetLength(unfilteredIds[i]))>1){
                filteredIds.push(i);
            }
        }
        return filteredIds;
    }

    const cleanBlocks = async () => {
        const tokenIDs = await findTokenIdsToClean();
        await ethersContract.clean(tokenIDs);
    }
    await cleanBlocks();
}
module.exports = { clean }