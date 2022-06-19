
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
    type TxInfo = {
        hash: string,
        nonce: number,
        blockHash: string,
        blockNumber: number,
        transactionIndex: number,
        from: string,
        to: string,
        value: string,
        gas: number,
        gasPrice: string,
        input: string,
    }

    type Owning = {
        owner: string,
        startBlock: number
    }

    function binarySearch(ar: Array<Owning>, el: Owning, compare_fn: Function): number {
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
        //didn't find it 
        return -m - 1;
    }

    function compareEras(a: Owning, b: Owning) {
        return b.startBlock - a.startBlock;
    }



    const { ERC721RABI, ERC721Raddress, web3, publicKey } = require('./constants');
    const contract = new web3.eth.Contract(ERC721RABI, ERC721Raddress);
    const transfers: Array<TransferFromEvent> = await contract.getPastEvents('Transfer', { filter: { transactionHash: txId } });
    const { blockNumber, from, to } = tx;


    const target: Owning = { owner: to, startBlock: blockNumber }

    const owningQueue: Array<Owning> = await contract.methods._owners(blockEra, from).call();

    let i = binarySearch(spenditures, target, compareEras);
    if (i < 0) throw Error('No such transaction found as a spenditure in ERC-20R contract.');
    for (; i < spenditures.length && compareEras(spenditures[i], target) == 0; i++) {
        const curr = spenditures[i];
        if (curr.amount == target.amount && curr.to == target.to) {
            return i;
        }
    }
    throw Error('No such transaction found as a spenditure in ERC-20R contract.');
})()
