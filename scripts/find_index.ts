
//example script scraping all of the stored data in the contract that must be cleaned. 
const txId: string = '0x00'; //contested malicious transaction id 

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

type Spenditure = {
    to: string,
    from: string,
    amount: number,
    block_number: number
}

function binarySearch(ar: Array<Spenditure>, el: Spenditure, compare_fn: Function): number {
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

function compareEras(a, b) {
    return b.block_number - a.block_number;
}

(async () => {
    const { ERC20RABI, ERC20Raddress, web3, publicKey } = require('./constants');
    const contract = new web3.eth.Contract(ERC20RABI, ERC20Raddress);
    const tx: TxInfo = await web3.eth.getTransaction(txId);
    const { blockNumber, from, to, value } = tx;
    const target: Spenditure = { from, to, block_number: blockNumber, amount: Number(value) }
    const DELTA: number = await contract.methods.DELTA.call();
    const blockEra = Math.floor(blockNumber / DELTA);
    const spenditures: Array<Spenditure> = await contract.methods.spenditures(blockEra, from).call();
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
