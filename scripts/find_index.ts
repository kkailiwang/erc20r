
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

function binarySearch(ar, el, compare_fn) {
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
            return k;
        }
    }
    return -m - 1;
}

(async () => {
    const { ERC20RABI, ERC20Raddress, web3, publicKey } = require('./constants');
    const contract = new web3.eth.Contract(ERC20RABI, ERC20Raddress);
    const tx: TxInfo = await web3.eth.getTransaction(txId);
    const { blockNumber, from, to, value } = tx;
    const DELTA: number = await contract.methods.DELTA.call();
    const blockEra = Math.floor(blockNumber / DELTA);
    const spenditures = await contract.methods.getSpenditures(blockEra, from).call();
    function compareEras(a, b) {

    }


})()
