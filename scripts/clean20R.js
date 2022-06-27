
//example script scraping all of the transaction data that must be cleaned for a given block era. 

const { ethers } = require("hardhat");

const clean = async (ethersContract, epoch) => {

    const findActiveAddressInBlockEra = async () => {
        const DELTA = await ethersContract.DELTA();
        const transfers = await ethersContract.queryFilter('Transfer', epoch * DELTA, (epoch + 1) * DELTA - 1);
        return Array(...new Set(transfers.map(transfer => transfer.args.from).filter(from => from != ethers.constants.AddressZero)));
    }

    const cleanForBlockEra = async () => {
        const addresses = await findActiveAddressInBlockEra(epoch);
        await ethersContract.clean(addresses, epoch)
    }
    await cleanForBlockEra(epoch);

}
module.exports = { clean } 