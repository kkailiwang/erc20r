
//example script scraping all of the stored data in the contract that must be cleaned. 

(async () => {

    const txId: string = '0x00'; //contested malicious transaction id 

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

    type Owning = {
        owner: string,
        startBlock: number
    }

    function binarySearch(ar: Array<Owning>, el: Owning, compare_fn: Function): number {
        // note: this binary search returns the first possible index of the recipient's record
        var m = 0;
        var n = ar.length - 1;
        while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compare_fn(el, ar[k]);
            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                //go backwards until you find the first instance
                while (k >= 0 && cmp == 0) {
                    k--;
                    cmp = compare_fn(el, ar[k]);
                }
                return k + 1;
            }
        }
        //didn't find the specific startBlock
        return -m - 1;
    }

    function compareBN(a: Owning, b: Owning) {
        return b.startBlock - a.startBlock;
    }

    const { ERC721RABI, ERC721Raddress, web3, publicKey } = require('./constants');
    const contract = new web3.eth.Contract(ERC721RABI, ERC721Raddress);
    const transfers: Array<TransferFromEvent> = await contract.getPastEvents('Transfer', { filter: { transactionHash: txId } });
    
    if (transfers.length != 1){
        throw Error('Invalid ERC-721R transaction hash.');
    }
    const from : string = transfers[0].returnValues.from;
    const to : string = transfers[0].returnValues.to;
    const tokenId : number = transfers[0].returnValues.tokenId;
    const blockNumber : number = transfers[0].blockNumber;

    const target: Owning = { owner: to, startBlock: blockNumber }

    const tokenIdOwners: Array<Owning> = await contract.methods._owners(tokenId).getOwningQueueArr();

    let i = binarySearch(tokenIdOwners, target, compareBN);
    if (i < 0) throw Error('No such transaction found as a Owning in ERC-721R contract.');
    if (i == 0) throw Error('No transaction sender.');
    for (; i < tokenIdOwners.length && compareBN(tokenIdOwners[i], target) == 0; i++) {
        const prev = tokenIdOwners[i-1];
        const curr = tokenIdOwners[i];
        if (prev.owner == from && curr.owner == target.owner) {
            return i + await contract.methods._owners(tokenId).getFirst();
        }
    }
    throw Error('No such transaction found as a spenditure in ERC-721R contract.');
})()
