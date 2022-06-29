const { findIndex } = require('../scripts/find_index721R');
const { clean } = require('../scripts/clean721R')
const { expect } = require("chai");
const TOTAL_SUPPLY = 10;

describe("ERC721R Offchain scripts", function () {

    let ExampleERC721R;
    let erc721r;
    let owner;
    let addr1;
    let addr2;
    let addr3;

    describe("Reasonable reversible period environment", function () {
        beforeEach(async function () {
            // Get the ContractFactory and Signers here.
            ExampleERC721R = await ethers.getContractFactory("ExampleERC721R");
            [owner, addr1, addr2, addr3] = await ethers.getSigners();

            erc721r = await ExampleERC721R.deploy(TOTAL_SUPPLY, 360, owner.address);
        });

        describe("findIndex", function () {
            let blockNumber;
            const tokenId = 0;
            let from;
            beforeEach(async function () {
            });

            it('findIndex works when index is 0', async () => {
                const tx = await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                from = tx.from;
                blockNumber = tx.blockNumber;

                const foundI = await findIndex(from, addr1.address, blockNumber, tokenId, erc721r);
                await erc721r.freeze(owner.address, addr1.address, tokenId, blockNumber, foundI);
                const logs = await erc721r.queryFilter('FreezeSuccessful');
                expect(logs.length).to.equal(1);
            });

            it('findIndex works when index is in middle of spenditures', async () => {
                await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                for (let i = 0; i < 10; i++) {
                    await erc721r.connect(addr1).transferFrom(addr1.address, addr1.address, tokenId);
                }

                // place the transaction we are interested in in the middle
                const tx = await erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, tokenId);
                from = tx.from;
                blockNumber = tx.blockNumber;

                for (let i = 0; i < 10; i++) {
                    await erc721r.connect(addr2).transferFrom(addr2.address, addr2.address, tokenId);
                }
                const foundI = await findIndex(from, addr2.address, blockNumber, tokenId, erc721r);
                await erc721r.freeze(from, addr2.address, tokenId, blockNumber, foundI);
                const logs = await erc721r.queryFilter('FreezeSuccessful');
                expect(logs.length).to.equal(1);
            });

            it('findIndex works when index is at end of spenditures', async () => {
                for (let i = 0; i < 13; i++) {
                    await erc721r.transferFrom(owner.address, owner.address, tokenId);
                }

                const tx = await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                from = tx.from;
                blockNumber = tx.blockNumber;

                const foundI = await findIndex(from, addr1.address, blockNumber, tokenId, erc721r);
                await erc721r.freeze(owner.address, addr1.address, tokenId, blockNumber, foundI);
                const logs = await erc721r.queryFilter('FreezeSuccessful');
                expect(logs.length).to.equal(1);
            });

        });

        describe("Clean", function () {
            let blockNumber;
            const tokenId0 = 0;
            const tokenId1 = 1;
            const tokenId2 = 2;
            const numReversibleBlocks = 1;
            beforeEach(async function () {
                // Get the ContractFactory and Signers here.
                ExampleERC721R = await ethers.getContractFactory("ExampleERC721R");
                [owner, addr1, addr2, addr3] = await ethers.getSigners();

                erc721r = await ExampleERC721R.deploy(TOTAL_SUPPLY, numReversibleBlocks, owner.address);

                const tx = await erc721r.transferFrom(owner.address, addr1.address, tokenId0);
                blockNumber = tx.blockNumber;
                await erc721r.transferFrom(owner.address, addr2.address, tokenId1);
                await erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, tokenId0);
                await erc721r.transferFrom(owner.address, addr2.address, tokenId2);

                token0Queue = erc721r.getOwnings(tokenId0);
                token1Queue = erc721r.getOwnings(tokenId1);
                token2Queue = erc721r.getOwnings(tokenId2);

                expect((await token0Queue).length).to.equal(3);
                expect((await token1Queue).length).to.equal(2);
                expect((await token2Queue).length).to.equal(2);

                let t = 0;
                const nextThreshold = blockNumber + numReversibleBlocks;
                while (t <= nextThreshold) {
                    t = await erc721r.connect(addr2).transferFrom(addr2.address, addr2.address, tokenId1);
                    t = t.blockNumber;
                }
            });

            it("Cleans when parameters are correct", async function () {
                await clean(erc721r, blockNumber);
                // clean all but the current owner
                expect((await erc721r.getOwnings(tokenId0)).length).to.equal(1);
                expect((await erc721r.getOwnings(tokenId2)).length).to.equal(1);
            });

        });

    });
});