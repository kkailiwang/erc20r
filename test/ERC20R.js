const { expect } = require("chai");
const TOTAL_SUPPLY = 1000;

describe("ERC20R", function () {

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

            // To deploy our contract, we just have to call ExampleERC20R.deploy() and await
            // for it to be deployed(), which happens once its transaction has been
            // mined.
            //for simplicity, let's make the owner the governance contract (and is able to call freeze and reverse)
            erc20r = await ExampleERC20R.deploy(TOTAL_SUPPLY, 360, owner.address);
            DELTA = await erc20r.DELTA();
        });

        // You can nest describe calls to create subsections.
        describe("Deployment", function () {
            // `it` is another Mocha function. This is the one you use to define your
            // tests. It receives the test name, and a callback function.

            // If the callback function is async, Mocha will `await` it.
            it("Should be a fixed supply model", async function () {
                // Expect receives a value, and wraps it in an Assertion object. These
                // objects have a lot of utility methods to assert values.

                // This test expects the owner variable stored in the contract to be equal
                // to our Signer's owner.
                expect(await erc20r.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
            });

        });

        describe("Transactions", function () {
            let blockNumber;

            it("Should transfer tokens between accounts and update spenditures", async function () {
                // Transfer 200 tokens from owner to addr1
                const tx = await erc20r.transfer(addr1.address, 200);
                blockNumber = tx.blockNumber;
                const addr1Balance = await erc20r.balanceOf(addr1.address);
                expect(addr1Balance).to.equal(200);

                // Transfer 100 tokens from addr1 to addr2
                // We use .connect(signer) to send a transaction from another account
                await erc20r.connect(addr1).transfer(addr2.address, 100);
                const addr2Balance = await erc20r.balanceOf(addr2.address);
                expect(addr2Balance).to.equal(100);

                const epoch = Math.floor(blockNumber / DELTA);

                //check spenditures mapping
                const spendituresOwner = await erc20r.getSpenditures(epoch, owner.address);
                expect(spendituresOwner.length).to.equal(1);
                expect(spendituresOwner[0][0]).to.equal(owner.address);
                expect(spendituresOwner[0][1]).to.equal(addr1.address);
                expect(spendituresOwner[0][2]).to.equal(200);
                expect(spendituresOwner[0][3]).to.equal(blockNumber);

                const spenditures1 = await erc20r.getSpenditures(epoch, addr1.address);
                expect(spenditures1.length).to.equal(1);
            });


        });

        describe("One-node suspect graph", function () {

            let blockNumber;
            const amount = 200;
            const index = 1;

            beforeEach(async function () {
                await erc20r.transfer(addr3.address, 100);
                const tx = await erc20r.transfer(addr1.address, amount);
                blockNumber = tx.blockNumber;
            });

            it("Freeze works on a one-node suspect graph", async function () {
                const claimID = await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, index);
                const frozen1 = await erc20r.frozen(addr1.address);
                expect(frozen1).to.equal(amount);
            });

            it("Freeze fails if wrong index provided, or out of range", async () => {
                await expect(erc20r.freeze(owner.address, addr1.address, amount, blockNumber, 0)).to.be.revertedWith("ERC20R: index given does not match spenditure");
                await expect(erc20r.freeze(owner.address, addr1.address, amount, blockNumber, 10)).to.be.revertedWith("ERC20R: Invalid index provided.")
            })

            it("Account can spend unfrozen money but can't spend frozen money", async function () {
                const claimID = await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, index);
                //addr1 is not allowed to send money now. 
                await expect(
                    erc20r.connect(addr1).transfer(addr2.address, 1)
                ).to.be.revertedWith("ERC20R: Cannot spend frozen money in account.");

                //can still receive payments 
                await erc20r.transfer(addr1.address, amount);

                //can still send as long as the frozen amount is still there
                await erc20r.connect(addr1).transfer(addr2.address, amount / 2)
                expect(await erc20r.balanceOf(addr2.address)).to.equal(amount / 2)

                //addr1 is not allowed to send money that is frozen. 
                await expect(
                    erc20r.connect(addr1).transfer(addr2.address, amount)
                ).to.be.revertedWith("ERC20R: Cannot spend frozen money in account.");
            })

            it("Reverse works", async function () {
                const freeze = erc20r.freeze(owner.address, addr1.address, amount, blockNumber, 1);
                expect(freeze).to.emit(erc20r, 'FreezeSuccessful');
                const tx = await freeze;
                const freezes = await erc20r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const claimID = freezes[0].args.claimID;
                const reverse = erc20r.reverse(claimID);
                expect(reverse).to.emit(erc20r, 'ReverseSuccessful');
                await reverse;
                const balance = await erc20r.balanceOf(owner.address);
                const balance1 = await erc20r.balanceOf(addr1.address);
                expect(balance).to.equal(TOTAL_SUPPLY - 100);
                expect(balance1).to.equal(0);
            });

            it("Reject Reverse works", async function () {
                const freeze = erc20r.freeze(owner.address, addr1.address, amount, blockNumber, 1);
                expect(freeze).to.emit(erc20r, 'FreezeSuccessful');
                const tx = await freeze;
                const freezes = await erc20r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const claimID = freezes[0].args.claimID;
                const reverse = erc20r.rejectReverse(claimID);
                expect(reverse).to.emit(erc20r, 'ReverseRejected');
                await reverse;
                const balance = await erc20r.balanceOf(owner.address);
                const balance1 = await erc20r.balanceOf(addr1.address);
                expect(balance).to.equal(TOTAL_SUPPLY - 100 - amount);
                expect(balance1).to.equal(amount);
            });


        });

        describe("multi-node graph ", function () {
            let blockNumber;
            const amount = 200;
            const index = 1;
            let freeze;
            beforeEach(async function () {
                await erc20r.transfer(addr3.address, amount / 4);
                const tx = await erc20r.transfer(addr1.address, amount);
                blockNumber = tx.blockNumber;
                await erc20r.connect(addr1).transfer(addr2.address, amount / 2);
                freeze = erc20r.freeze(owner.address, addr1.address, amount, blockNumber, index);

            })

            it("Freeze works on a multi-node suspect graph", async function () {
                expect(freeze).to.emit('FreezeSuccessful');
                const frozen1 = await erc20r.frozen(addr1.address);
                const frozen2 = await erc20r.frozen(addr2.address);

                expect(frozen1).to.equal(await erc20r.balanceOf(addr1.address));
                expect(frozen2).to.equal(amount / 2);

            });

        })

        describe("Unequal weights in multi-node graph ", function () {
            let blockNumber;
            const amount = 200;
            const index = 1;
            let freeze;
            beforeEach(async function () {
                await erc20r.transfer(addr1.address, amount / 4);
                const tx = await erc20r.transfer(addr1.address, amount);
                blockNumber = tx.blockNumber;
                await erc20r.connect(addr1).transfer(addr2.address, amount / 4);
                await erc20r.connect(addr1).transfer(addr3.address, amount / 2);
                freeze = erc20r.freeze(owner.address, addr1.address, amount, blockNumber, index);

            })

            it("Freeze works on a larger suspect graph with unequal weights", async function () {

                //addr1 should have amount / 2
                //addr2 should have 1/4 amount 
                //addr3 should have amount / 2

                expect(await erc20r.balanceOf(addr1.address)).to.equal(amount / 2);
                expect(await erc20r.balanceOf(addr2.address)).to.equal(amount / 4);
                expect(await erc20r.balanceOf(addr3.address)).to.equal(amount / 2);

                //frozen1 should be amount / 2
                //frozen2 shoudl be 1/3 * 1/2 * amount 
                //frozen3 should be 2/3 * 1/2 * amount 

                await freeze;
                const frozen1 = await erc20r.frozen(addr1.address);
                const frozen2 = await erc20r.frozen(addr2.address);
                const frozen3 = await erc20r.frozen(addr3.address);

                expect(frozen1).to.equal(amount / 2);
                expect(frozen2).to.equal(Math.floor(amount / 6));
                expect(frozen3).to.equal(Math.floor(amount / 3));

            });

            it('fails if still in reversible time period', async () => {
                const epoch = Math.floor(blockNumber / DELTA)
                await expect(erc20r.clean([owner.address, addr1.address], epoch)).to.be.revertedWith("ERC20-R: Block Epoch is not allowed to be cleared yet.");
            })
        })
    })


    describe("Some transactions are out of reversible time period", function () {
        let blockNumber;
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
            const epoch = Math.floor(blockNumber / DELTA);

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

        it('Freeze does not work for expired transaction', async () => {
            freeze = erc20r.freeze(owner.address, addr1.address, amount, blockNumber, 0);
            await expect(freeze).to.be.revertedWith('ERC20R: specified transaction is no longer reversible.');

        })

        it("Cleans when parameters are correct", async function () {
            const epoch = Math.floor(blockNumber / DELTA);
            const ownerSpends = erc20r.getSpenditures(epoch, owner.address);
            const addr1Spends = erc20r.getSpenditures(epoch, addr1.address);

            expect((await ownerSpends).length).to.equal(3);
            expect((await addr1Spends).length).to.equal(1);
            const clean = erc20r.clean([owner.address, addr1.address, addr2.address], epoch)

            await clean;
            expect((await erc20r.getSpenditures(epoch, owner.address)).length).to.equal(0);
            expect((await erc20r.getSpenditures(epoch, addr1.address)).length).to.equal(0);

            const events = await erc20r.queryFilter('ClearedDataInTimeblock');
            expect(events.length).to.equal(1);
        });

        it("Fails if doesn't include all addresses for epoch", async function () {
            const epoch = Math.floor(blockNumber / DELTA);
            await expect(erc20r.clean([owner.address, addr1.address], epoch)).to.be.revertedWith("ERC20R: Must clear the entire block Epoch's data at once.");
            await expect(erc20r.clean([owner.address, addr2.address, addr3.address], epoch)).to.be.revertedWith("ERC20R: addresses to clean for block Epoch does not match the actual data storage.");

        });

    })

});

