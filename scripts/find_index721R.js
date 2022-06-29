const { BigNumber } = require("ethers");

function binarySearch(ar, el, compare_fn) {
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
            while (k > 0) {
                cmp = compare_fn(el, ar[k - 1]);
                if (cmp !== 0) break;
                k--;
            }
            if (k > 0) { // possibility that transaction from owning starts with a different block
                return k - 1;
            }else { // the block numer we are looking for is the first block since mint, otherwise should always keep at least one record before the expired block threshold
                return k;
            }
        }
    }
    //didn't find the specific startBlock
    return -m - 1;
}

function compareBN(target, elem) {
    return target.startBlock - elem.startBlock;
}

const findIndex = async (from, to, block_number, tokenId, ethersContract) => {
    const target = { to: to, startBlock: block_number };
    const tokenIdOwners = await ethersContract.getOwnings(tokenId);
    // Note, we are trying to find the index associated with the victim's owning
    let i = binarySearch(tokenIdOwners, target, compareBN);
    if (i < 0) throw Error('No such transaction found as a Owning in ERC-721R contract, or transaction expired.');
    // treat first instance differently because the first "from owning" startBlock doesn't necessarily match the target
    let curr = tokenIdOwners[i];
    let next = tokenIdOwners[i + 1];
    if (curr.owner == from && next.owner == target.to) {
        //convert to absolute index 
        return BigInt(i) + BigInt(await ethersContract.owningGetFirst(tokenId));
    }
    i ++;
    
    for (; i < (tokenIdOwners.length - 1) && compareBN(tokenIdOwners[i], target) == 0; i++) {
        curr = tokenIdOwners[i];
        next = tokenIdOwners[i + 1];
        if (curr.owner == from && next.owner == target.to) {
            //convert to absolute index 
            return i + await ethersContract.owningGetFirst(tokenId);
        }
    }
    throw Error('No such transaction found as a owning in ERC-721R contract.');
}
module.exports = { findIndex }