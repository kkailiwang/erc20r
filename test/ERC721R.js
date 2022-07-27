const { expect } = require("chai");
const TOTAL_SUPPLY = 10;

describe("ERC721R", function () {

    let ExampleERC721R;
    let erc721r;
    let owner;
    let addr1;
    let addr2;
    let addr3;

    //manualMine is bool - true if auto-mining is turned off
    const functionalTests = (manualMine) => {

        const ensureMine = async () => {
            if (!manualMine) return;
            await hre.network.provider.send("hardhat_mine", []);
        }

        describe("Transactions", function () {
            let blockNumber;
            let tokenId = 0;

            it("Should transfer tokens between accounts and update _owners", async function () {
                // Transfer token 0 from owner to addr1
                let tx = await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                await ensureMine(manualMine);
                tx = await hre.network.provider.send('eth_getTransactionByHash', [tx.hash]);
                blockNumber = tx.blockNumber;

                const token0Owner = await erc721r.ownerOf(tokenId);
                expect(token0Owner).to.equal(addr1.address);

                // Transfer token 0 from addr1 to addr2
                // We use .connect(signer) to send a transaction from another account
                await erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, tokenId);

                await ensureMine(manualMine);
                const newToken0Owner = await erc721r.ownerOf(tokenId);
                expect(newToken0Owner).to.equal(addr2.address);

                //check OwningQueue
                const token0OwningQueue = await erc721r.getOwnings(tokenId);
                expect(token0OwningQueue.length).to.equal(3);
                expect(token0OwningQueue[0].owner).to.equal(owner.address);
                expect(token0OwningQueue[1].owner).to.equal(addr1.address);
                expect(token0OwningQueue[2].owner).to.equal(addr2.address);
                expect(token0OwningQueue[1].startBlock).to.equal(blockNumber);

                const token1OwningQueue = await erc721r.getOwnings(1);
                expect(token1OwningQueue.length).to.equal(1);
            });
        });

        describe("One-node suspect graph", function () {
            const tokenId = 0;
            const index = 1;

            beforeEach(async function () {
                await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                await ensureMine(manualMine);
                let tx = await erc721r.connect(addr1).transferFrom(addr1.address, addr3.address, tokenId);
                await ensureMine(manualMine);
                tx = await hre.network.provider.send('eth_getTransactionByHash', [tx.hash]);
            });

            it("Freeze works on a one-node suspect graph", async function () {
                await erc721r.freeze(tokenId, index);
                await ensureMine(manualMine);
                const frozen0 = await erc721r._frozen(tokenId);
                await ensureMine(manualMine);
                expect(frozen0).to.equal(true);
            });

            it("Freeze fails if wrong index provided, or out of range", async () => {
                const freeze = erc721r.freeze(tokenId, 10);
                if (manualMine) {
                    await freeze;
                    await ensureMine(manualMine)
                    expect((await erc721r.queryFilter('FreezeSuccessful')).length).to.equal(0);
                } else {
                    await expect(freeze).to.be.revertedWith("ERC721R: Verification of specified transaction failed.");
                }
            });

            it("Account cannot transfer frozen token", async function () {
                await erc721r.freeze(tokenId, index);
                await ensureMine(manualMine);
                //addr1 is not allowed to send tokens now.
                if (manualMine) {
                    const oldTransfers = await erc721r.queryFilter('Transfer');
                    await erc721r.connect(addr3).transferFrom(addr3.address, addr2.address, tokenId);
                    await ensureMine(manualMine);
                    const newTransfers = await erc721r.queryFilter('Transfer');
                    expect(newTransfers.length - oldTransfers.length).to.equal(0);
                }else{
                    await expect(
                        erc721r.connect(addr3).transferFrom(addr3.address, addr2.address, tokenId)
                    ).to.be.revertedWith("ERC721R: transfer frozen token");
                }

                //can still receive other tokens
                let otherToken = 1;
                await erc721r.transferFrom(owner.address, addr1.address, otherToken);
                await ensureMine(manualMine);

                //can still send other token
                await erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, otherToken);
                await ensureMine(manualMine);
                expect(await erc721r.ownerOf(otherToken)).to.equal(addr2.address);

                //cannot spend a token you do not own
                if (manualMine){
                    const oldTransfers = await erc721r.queryFilter('Transfer');
                    await erc721r.connect(addr3).transferFrom(addr3.address, addr2.address, tokenId);
                    await ensureMine(manualMine);
                    const newTransfers = await erc721r.queryFilter('Transfer');
                    expect(newTransfers.length - oldTransfers.length).to.equal(0);
                }else{
                    await expect(
                        erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, otherToken)
                    ).to.be.revertedWith("ERC721R: transfer caller is not owner nor approved");
                }
            })

            it("Reverse works", async function () {
                const freeze = erc721r.freeze(tokenId, index);
                expect(freeze).to.emit(erc721r, 'FreezeSuccessful');
                await freeze;
                await ensureMine(manualMine);
                const freezes = await erc721r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const victim = freezes[0].args.from;
                const reverse = erc721r.reverse(tokenId, index);
                expect(reverse).to.emit(erc721r, 'ReverseSuccessful');
                await reverse;
                await ensureMine(manualMine);
                const ownerOf0 = await erc721r.ownerOf(tokenId);
                expect(ownerOf0).to.equal(addr1.address);
            });

            it("Reject Reverse works", async function () {
                const freeze = erc721r.freeze(tokenId, index);
                expect(freeze).to.emit(erc721r, 'FreezeSuccessful');
                await freeze;
                await ensureMine(manualMine);
                const freezes = await erc721r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                
                const reverse = erc721r.rejectReverse(tokenId);
                expect(reverse).to.emit(erc721r, 'ReverseRejected');
                await reverse;
                await ensureMine(manualMine);
                const ownerOf0 = await erc721r.ownerOf(tokenId);
                expect(ownerOf0).to.equal(addr3.address);
                const frozen0 = await erc721r._frozen(tokenId);
                expect(frozen0).to.equal(false);
            });
        });

        describe("multi-node graph", function () {
            const tokenId = 0;
            const index = 0;
            let freeze;

            beforeEach(async function () {
                let tx = await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                await ensureMine(manualMine);
                tx = await hre.network.provider.send('eth_getTransactionByHash', [tx.hash]);
                await erc721r.connect(addr1).transferFrom(addr1.address, addr3.address, tokenId);
                await ensureMine(manualMine);
                freeze = erc721r.freeze(tokenId, index);
                await ensureMine(manualMine);
                expect(freeze).to.emit('FreezeSuccessful');
                await freeze;
                await ensureMine(manualMine);
            });

            it("Freeze works on a multi-node suspect graph", async function () {
                const frozen0 = await erc721r._frozen(tokenId);
                expect(frozen0).to.equal(true);
            });

            it("Reverse works on a multi-node suspect graph", async function () {
                const freezes = await erc721r.queryFilter('FreezeSuccessful');
                await ensureMine(manualMine);
                expect(freezes.length).to.equal(1);
                const reverse = erc721r.reverse(tokenId, 0);
                expect(reverse).to.emit(erc721r, 'ReverseSuccessful');
                await reverse;
                await ensureMine(manualMine);
                const ownerOf0 = await erc721r.ownerOf(tokenId);
                expect(ownerOf0).to.equal(owner.address);
            });
        });
    }

    describe("Reasonable reversible period environment", function () {
        // `beforeEach` will run before each test, re-deploying the contract every
        // time. It receives a callback, which can be async.
        beforeEach(async function () {
            // Get the ContractFactory and Signers here.
            ExampleERC721R = await ethers.getContractFactory("ExampleERC721R");
            [owner, addr1, addr2, addr3] = await ethers.getSigners();

            // To deploy our contract, we just have to call ExampleERC721R.deploy() and await
            // for it to be deployed(), which happens once its transaction has been
            // mined.
            //for simplicity, let's make the owner the governance contract (and is able to call freeze and reverse)
            erc721r = await ExampleERC721R.deploy(TOTAL_SUPPLY, 360, owner.address);
        });

        describe("Deployment", function () {
            // `it` is another Mocha function. This is the one you use to define your
            // tests. It receives the test name, and a callback function.

            // If the callback function is async, Mocha will `await` it.
            it("Check initial token allocation", async function () {
                // Expect receives a value, and wraps it in an Assertion object. These
                // objects have a lot of utility methods to assert values.

                for (let i = 0; i < TOTAL_SUPPLY; i++) {
                    expect(await erc721r.ownerOf(i)).to.equal(owner.address);
                }
            });
        });

        describe("each transaction is in a different block", function () {
            functionalTests(false);
        });

        describe('Some transactions are in the same block', function () {
            before(async function () {
                await network.provider.send("evm_setAutomine", [false]);
                await network.provider.send("evm_setIntervalMining", [50]);
            })
            functionalTests(true);
            after(async () => await network.provider.send("evm_setAutomine", [true]));
        });
    });

    describe("Some transactions are out of reversible time period", function () {
        let blockNumber;
        const tokenId0 = 0;
        const tokenId1 = 1;
        const tokenId2 = 2;
        let token0Queue;
        let token1Queue;
        const numReversibleBlocks = 1;
        beforeEach(async function () {
            // Get the ContractFactory and Signers here.
            ExampleERC721R = await ethers.getContractFactory("ExampleERC721R");
            [owner, addr1, addr2, addr3] = await ethers.getSigners();

            // To deploy our contract, we just have to call ExampleERC721R.deploy() and await
            // for it to be deployed(), which happens once its transaction has been
            // mined.
            //for simplicity, let's make the owner the governance contract (and is able to call freeze and reverse)
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

        it('Freeze does not work for expired transaction', async () => {
            await expect(erc721r.freeze(tokenId0, 0)).to.be.revertedWith('ERC721R: specified transaction is no longer reversible.');
        });

        it("Cleans when parameters are correct", async function () {
            const clean = erc721r.clean([tokenId0, tokenId2]);
            await clean;
            // clean all but the current owner
            expect((await erc721r.getOwnings(tokenId0)).length).to.equal(1);
            expect((await erc721r.getOwnings(tokenId2)).length).to.equal(1);
        });
    });
});