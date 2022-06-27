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
    const { ERC721RABI, ERC721Raddress, web3, publicKey } = require('./constants');
    const contract = new web3.eth.Contract(ERC721RABI, ERC721Raddress);
    const findTokenIdsToClean = () => __awaiter(void 0, void 0, void 0, function* () {
        const numReversibleBlocks = yield contract.methods.NUM_REVERSIBLE_BLOCKS().call();
        const currblock = yield web3.eth.getBlockNumber();
        const transfers = yield contract.getPastEvents('Transfer', { fromBlock: 0, toBlock: currblock - numReversibleBlocks });
        return Array(...new Set(transfers.map(transfer => transfer.returnValues.tokenId)));
    });
    const clean = () => __awaiter(void 0, void 0, void 0, function* () {
        const tokenIDs = yield findTokenIdsToClean();
        yield contract.methods.clean(tokenIDs).send({
            from: publicKey,
            gas: 200000
        });
    });
    yield clean();
}))();
