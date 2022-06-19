
//example script scraping all of the stored data in the contract that must be cleaned. 

type TransferFromEvent = {
    returnValues: {
        from: string,
        to: string,
        tokenId: number,
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


    const { ERC721RABI, ERC721Raddress, web3, publicKey } = require('./constants');
    const contract = new web3.eth.Contract(ERC721RABI, ERC721Raddress);
    const findTokenIdsToClean = async () => {
        const numReversibleBlocks = await contract.methods.NUM_REVERSIBLE_BLOCKS().call();
        const currblock = await web3.eth.getBlockNumber();
        const transfers: Array<TransferFromEvent> = await contract.getPastEvents('Transfer', { fromBlock: 0, toBlock: currblock - numReversibleBlocks });
        return Array(...new Set(transfers.map(transfer => transfer.returnValues.tokenId)));
    }

    const clean = async () => {
        const tokenIDs: Array<string> = await findTokenIdsToClean();
        await contract.methods.clean(tokenIDs).send({
            from: publicKey,
            gas: 200000
        });
    }
    await clean();

})()
