const { findIndex } = require('../scripts/find_index20R');
const { clean } = require('../scripts/clean20R')
const { expect } = require("chai");
const TOTAL_SUPPLY = 1000;

describe("ERC20R Offchain scripts", function () {

    let ExampleERC20R;
    let erc20r;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let DELTA;

    describe("Reasonable reversible period environment", function () {
        // `beforeEach` will run before each test, re-deploying the contract every
        // time. It receives a callback, which can be async.
        beforeEach(async function () {
            // Get the ContractFactory and Signers here.
            ExampleERC20R = await ethers.getContractFactory("ExampleERC20R");
            [owner, addr1, addr2, addr3] = await ethers.getSigners();

            erc20r = await ExampleERC20R.deploy(TOTAL_SUPPLY, 360, owner.address);
            DELTA = await erc20r.DELTA();
        });

        describe("findIndex", function () {
            let blockNumber;
            const amount = 200;
            const index = 1;
            let from;
            beforeEach(async function () {
            })

            it('findIndex works when index is 0', async () => {
                const tx = await erc20r.transfer(addr1.address, amount);
                from = tx.from;
                blockNumber = tx.blockNumber;

                const foundI = await findIndex(from, addr1.address, blockNumber, amount, erc20r);
                await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, foundI);
                const logs = await erc20r.queryFilter('FreezeSuccessful');
                expect(logs.length).to.equal(1);
            });


            it('findIndex works when index is in middle of spenditures', async () => {
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);

                const tx = await erc20r.transfer(addr1.address, amount);
                from = tx.from;
                blockNumber = tx.blockNumber;

                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);



                const foundI = await findIndex(from, addr1.address, blockNumber, amount, erc20r);
                await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, foundI);
                const logs = await erc20r.queryFilter('FreezeSuccessful');
                expect(logs.length).to.equal(1);

            });

            it('findIndex works when index is at end of spenditures', async () => {
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);
                await erc20r.transfer(addr1.address, 1);

                const tx = await erc20r.transfer(addr1.address, amount);
                from = tx.from;
                blockNumber = tx.blockNumber;

                const foundI = await findIndex(from, addr1.address, blockNumber, amount, erc20r);
                await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, foundI);
                const logs = await erc20r.queryFilter('FreezeSuccessful');
                expect(logs.length).to.equal(1);

            });


        })


        describe("Clean", function () {
            let blockNumber, epoch;
            const amount = 100;
            beforeEach(async function () {
                // Get the ContractFactory and Signers here.
                ExampleERC20R = await ethers.getContractFactory("ExampleERC20R");
                [owner, addr1, addr2, addr3] = await ethers.getSigners();

                // To deploy our contract, we just have to call ExampleERC20R.deploy() and await
                // for it to be deployed(), which happens once its transaction has been
                // mined.
                //for simplicity, let's make the owner the governance contract (and is able to call freeze and reverse)
                erc20r = await ExampleERC20R.deploy(TOTAL_SUPPLY, 1, owner.address);
                DELTA = await erc20r.DELTA();

                const tx = await erc20r.transfer(addr1.address, amount);
                blockNumber = tx.blockNumber;
                await erc20r.transfer(addr2.address, 100);
                await erc20r.transfer(addr3.address, 100);
                await erc20r.connect(addr1).transfer(addr2.address, 50);
                epoch = Math.floor(blockNumber / DELTA);

                const ownerSpends = erc20r.getSpenditures(epoch, owner.address);
                const addr1Spends = erc20r.getSpenditures(epoch, addr1.address);

                expect((await ownerSpends).length).to.equal(3);
                expect((await addr1Spends).length).to.equal(1);

                let t = 0;
                const nextThreshold = (epoch + 1) * DELTA;
                while (t < nextThreshold) {
                    t = await erc20r.connect(addr2).transfer(addr2.address, 1);
                    t = t.blockNumber;
                }
            })


            it("Cleans when parameters are correct", async function () {
                await clean(erc20r, epoch);

                const events = await erc20r.queryFilter('ClearedDataInTimeblock');
                expect(events.length).to.equal(1);
            });
        })
    });
});