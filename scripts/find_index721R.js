"use strict";
//example script scraping all of the stored data in the contract that must be cleaned. 
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(() => __awaiter(void 0, void 0, void 0, function* () {
    const txId = '0x00'; //contested malicious transaction id 
    function binarySearch(ar, el, compare_fn) {
        // note: this binary search returns the first possible index of the recipient's record
        var m = 0;
        var n = ar.length - 1;
        while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compare_fn(el, ar[k]);
            if (cmp > 0) {
                m = k + 1;
            }
            else if (cmp < 0) {
                n = k - 1;
            }
            else {
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
    function compareBN(a, b) {
        return b.startBlock - a.startBlock;
    }
    const { ERC721RABI, ERC721Raddress, web3, publicKey } = require('./constants');
    const contract = new web3.eth.Contract(ERC721RABI, ERC721Raddress);
    //get transfer event with this transaction hash.
    const transfers = yield contract.getPastEvents('Transfer', { filter: { transactionHash: txId } });
    if (transfers.length != 1) {
        throw Error('Invalid ERC-721R transaction hash.');
    }
    const { from, to, tokenId } = transfers[0].returnValues;
    const blockNumber = transfers[0].blockNumber;
    const target = { owner: to, startBlock: blockNumber };
    //gets the active owning queue (not absolute indices)
    const tokenIdOwners = yield contract.methods._owners(tokenId).getOwningQueueArr();
    let i = binarySearch(tokenIdOwners, target, compareBN);
    if (i < 0)
        throw Error('No such transaction found as a Owning in ERC-721R contract.');
    if (i == 0)
        throw Error('No transaction sender.');
    for (; i < tokenIdOwners.length && compareBN(tokenIdOwners[i], target) == 0; i++) {
        const prev = tokenIdOwners[i - 1];
        const curr = tokenIdOwners[i];
        if (prev.owner == from && curr.owner == target.owner) {
            //convert to absolute index 
            return i + (yield contract.methods._owners(tokenId).getFirst());
        }
    }
    throw Error('No such transaction found as a spenditure in ERC-721R contract.');
}))();
