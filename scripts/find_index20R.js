
//example script scraping all of the stored data in the contract that must be cleaned. 

//finds first instance of a spenditure that has the specified block number 
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
            //go backwards until you find the first instance
            while (k > 0) {
                cmp = compare_fn(el, ar[k - 1]);
                if (cmp !== 0) break;
                k--;
            }
            return k;
        }
    }
    //didn't find it 
    return -m - 1;
}

function compareEras(target, elem) {
    return target.blockNumber - elem.blockNumber;
}

const findIndex = async (from, to, blockNumber, amount, ethersContract) => {
    const target = { from, to, blockNumber, amount }
    const DELTA = await ethersContract.DELTA();
    const blockEra = Math.floor(blockNumber / DELTA);
    const spenditures = await ethersContract.getSpenditures(blockEra, from);
    let i = binarySearch(spenditures, target, compareEras);
    if (i < 0) throw Error('No such transaction found as a spenditure in ERC-20R contract.');
    for (; i < spenditures.length && compareEras(spenditures[i], target) == 0; i++) {
        const curr = spenditures[i];
        if (curr.amount == target.amount && curr.to == target.to) {
            return i;
        }
    }
    throw Error('No such transaction found as a spenditure in ERC-20R contract.');
}
module.exports = { findIndex }