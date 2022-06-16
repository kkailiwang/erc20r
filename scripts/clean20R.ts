
//example script scraping all of the transaction data that must be cleaned for a given block era. 
const { ERC20RABI, ERC20Raddress, web3, publicKey } = require('./constants');

type TransferEvent = {
    returnValues: {
        src: string,
        dst: string,
        wad: number,
    },
    raw: object,
    event: string,
    signature: string,
    logIndex: number,
    transactionIndex: number,
    transactionHash: string,
    blockHash: string,
    blockNumber: number,
    address: string,
}


(async () => {
    const contract = new web3.eth.Contract(ERC20RABI, ERC20Raddress);

    const findActiveAddressInBlockEra = async (era: number) => {
        const DELTA: number = await contract.methods.DELTA.call();
        const transfers: Array<TransferEvent> = await contract.getPastEvents('transfer',
            { fromBlock: era * DELTA, toBlock: (era + 1) * DELTA - 1 });
        return Array(...new Set(transfers.map(transfer => transfer.returnValues.src)));
    }

    const blockera = 10;

    const cleanForBlockEra = async (era: number) => {
        const addresses: Array<string> = await findActiveAddressInBlockEra(era);
        await contract.methods.clean(addresses, era).send({
            from: publicKey,
            gas: 200000
        });
    }
    await cleanForBlockEra(blockera);

})()