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



    //manualMine is bool - true if auto-mining is turned off
    const functionalTests = (manualMine) => {

        const ensureMine = async () => {
            if (!manualMine) return;
            await hre.network.provider.send("hardhat_mine", []);
        }

        describe("Transactions", function () {
            let blockNumber;

            it("Should transfer tokens between accounts and update spenditures", async function () {
                // Transfer 200 tokens from owner to addr1
                let tx = await erc20r.transfer(addr1.address, 200);
                await ensureMine(manualMine);
                tx = await hre.network.provider.send('eth_getTransactionByHash', [tx.hash]);
                blockNumber = tx.blockNumber;

                const addr1Balance = await erc20r.balanceOf(addr1.address);

                expect(addr1Balance).to.equal(200);

                // Transfer 100 tokens from addr1 to addr2
                // We use .connect(signer) to send a transaction from another account
                await erc20r.connect(addr1).transfer(addr2.address, 100);
                await ensureMine(manualMine);
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
            let epoch;
            const amount = 200;
            const amountToAddr3 = 100;
            const index = 1;
            const indexToAddr3 = 0;
            const index3To2 = 3;

            beforeEach(async function () {
                await erc20r.transfer(addr3.address, amountToAddr3);
                let tx = await erc20r.transfer(addr1.address, amount);
                await ensureMine(manualMine);

                tx = await hre.network.provider.send('eth_getTransactionByHash', [tx.hash]);
                const blockNumber = tx.blockNumber;
                epoch = Math.floor(blockNumber / DELTA);
            });

            it("Freeze works on a one-node suspect graph", async function () {
                const claimID = await erc20r.freeze(epoch, owner.address, index);
                await ensureMine(manualMine);

                const frozen1 = await erc20r.frozen(addr1.address);
                expect(frozen1).to.equal(amount);
            });

            it("Freeze fails if wrong index provided, or out of range", async () => {
                const freeze = erc20r.freeze(epoch, owner.address, 10);
                if (manualMine) {
                    await freeze;
                    await ensureMine(manualMine)
                    expect((await erc20r.queryFilter('FreezeSuccessful')).length).to.equal(0);
                } else {
                    await expect(freeze).to.be.revertedWith("ERC20R: Invalid index provided.");
                }
            });

            it("Account can spend unfrozen money but can't spend frozen money", async function () {
                const claimID = await erc20r.freeze(epoch, owner.address, index);
                await ensureMine(manualMine);

                //addr1 is not allowed to send money now. 
                if (manualMine) {
                    const oldTransfers = await erc20r.queryFilter('Transfer');
                    let newtx = await erc20r.connect(addr1).transfer(addr2.address, 1);
                    await ensureMine(manualMine);
                    const newTransfers = await erc20r.queryFilter('Transfer');
                    expect(newTransfers.length - oldTransfers.length).to.equal(0);
                } else {
                    await expect(
                        erc20r.connect(addr1).transfer(addr2.address, 1)
                    ).to.be.revertedWith("ERC20R: Cannot spend frozen money in account.");
                }

                //can still receive payments 
                await erc20r.transfer(addr1.address, amount);

                //can still send as long as the frozen amount is still there
                await erc20r.connect(addr1).transfer(addr2.address, amount / 2)
                await ensureMine(manualMine);

                expect(await erc20r.balanceOf(addr2.address)).to.equal(amount / 2)

                //addr1 is not allowed to send money that is frozen. 

                if (manualMine) {
                    const oldTransfers = await erc20r.queryFilter('Transfer');
                    let newtx = await erc20r.connect(addr1).transfer(addr2.address, amount);
                    await ensureMine(manualMine);
                    const newTransfers = await erc20r.queryFilter('Transfer');
                    expect(newTransfers.length - oldTransfers.length).to.equal(0);
                } else {
                    await expect(
                        erc20r.connect(addr1).transfer(addr2.address, amount)
                    ).to.be.revertedWith("ERC20R: Cannot spend frozen money in account.");
                }
            });

            it("Account can burn unfrozen money but cannot burn frozen money.", async function (){
                const claimID = await erc20r.freeze(epoch, owner.address, index);
                await ensureMine(manualMine);

                //addr1 is not allowed to burn money now. 
                if (manualMine) {
                    const oldTransfers = await erc20r.queryFilter('Transfer');
                    let newtx = await erc20r.connect(addr1).burn(amount);
                    await ensureMine(manualMine);
                    const newTransfers = await erc20r.queryFilter('Transfer');
                    expect(newTransfers.length - oldTransfers.length).to.equal(0);
                } else {
                    await expect(
                        erc20r.connect(addr1).burn(amount)
                    ).to.be.revertedWith("ERC20R: burn amount exceeds unfrozen balance");
                }

                //can still receive payments 
                await erc20r.transfer(addr1.address, amount);

                //can burn the additional received amount
                await erc20r.connect(addr1).burn(amount / 2)
                await ensureMine(manualMine);

                expect(await erc20r.balanceOf(addr1.address)).to.equal(3 * amount / 2)

                //addr1 is not allowed to burn extra amount

                if (manualMine) {
                    const oldTransfers = await erc20r.queryFilter('Transfer');
                    let newtx = await erc20r.connect(addr1).burn(amount);
                    await ensureMine(manualMine);
                    const newTransfers = await erc20r.queryFilter('Transfer');
                    expect(newTransfers.length - oldTransfers.length).to.equal(0);
                } else {
                    await expect(
                        erc20r.connect(addr1).burn(amount)
                    ).to.be.revertedWith("ERC20R: burn amount exceeds unfrozen balance");
                }
            });

            it("Burning reduces the amount accountable.", async function (){
                // make a couple of more transactions from address 3 to 2
                await erc20r.transfer(addr3.address, 100);
                await erc20r.connect(addr3).transfer(addr2.address, 50);
                // address 3 burns the same amount as stolen
                await erc20r.connect(addr3).burn(amountToAddr3);
                await ensureMine(manualMine);
                const claimID = await erc20r.freeze(epoch, owner.address, indexToAddr3);
                
                // since address 3 has burned, address 2 should not be frozen
                const frozenAddr2 = await erc20r.frozen(addr2.address);
                expect(frozenAddr2).to.equal(0);
            });

            it("Reverse works", async function () {
                const freeze = erc20r.freeze(epoch, owner.address, 1);

                expect(freeze).to.emit(erc20r, 'FreezeSuccessful');
                const tx = await freeze;
                await ensureMine(manualMine);

                const freezes = await erc20r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const claimID = freezes[0].args.claimID;
                const reverse = erc20r.reverse(claimID);

                expect(reverse).to.emit(erc20r, 'ReverseSuccessful');
                await reverse;
                await ensureMine(manualMine);

                const balance = await erc20r.balanceOf(owner.address);
                const balance1 = await erc20r.balanceOf(addr1.address);
                expect(balance).to.equal(TOTAL_SUPPLY - 100);
                expect(balance1).to.equal(0);
            });

            it("Reject Reverse works", async function () {
                const freeze = erc20r.freeze(epoch, owner.address, 1);

                expect(freeze).to.emit(erc20r, 'FreezeSuccessful');
                const tx = await freeze;
                await ensureMine(manualMine);

                const freezes = await erc20r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const claimID = freezes[0].args.claimID;
                const reverse = erc20r.rejectReverse(claimID);

                expect(reverse).to.emit(erc20r, 'ReverseRejected');
                await reverse;
                await ensureMine(manualMine);

                const balance = await erc20r.balanceOf(owner.address);
                const balance1 = await erc20r.balanceOf(addr1.address);
                expect(balance).to.equal(TOTAL_SUPPLY - 100 - amount);
                expect(balance1).to.equal(amount);
            });
        });

        describe("multi-node graph ", function () {
            let epoch;
            const amount = 200;
            const index = 1;
            let freeze;
            beforeEach(async function () {
                await erc20r.transfer(addr3.address, amount / 4);
                await ensureMine(manualMine);

                let tx = await erc20r.transfer(addr1.address, amount);
                await ensureMine(manualMine);
                tx = await hre.network.provider.send('eth_getTransactionByHash', [tx.hash]);
                const blockNumber = tx.blockNumber;
                epoch = Math.floor(blockNumber / DELTA);
                await erc20r.connect(addr1).transfer(addr2.address, amount / 2);
                await ensureMine(manualMine);

                freeze = erc20r.freeze(epoch, owner.address, index);
                await ensureMine(manualMine);
            });

            it("Freeze works on a multi-node suspect graph", async function () {
                expect(freeze).to.emit('FreezeSuccessful');
                await freeze;
                await ensureMine(manualMine);

                const frozen1 = await erc20r.frozen(addr1.address);
                const frozen2 = await erc20r.frozen(addr2.address);

                expect(frozen1).to.equal(await erc20r.balanceOf(addr1.address));
                expect(frozen2).to.equal(amount / 2);

            });

        })

        describe("Unequal weights in multi-node graph ", function () {
            let epoch;
            const amount = 200;
            const index = 1;
            let freeze;
            beforeEach(async function () {
                await erc20r.transfer(addr1.address, amount / 4);
                await ensureMine(manualMine);

                let tx = await erc20r.transfer(addr1.address, amount);
                await ensureMine(manualMine);
                tx = await hre.network.provider.send('eth_getTransactionByHash', [tx.hash]);

                const blockNumber = tx.blockNumber;
                epoch = Math.floor(blockNumber / DELTA);
                await erc20r.connect(addr1).transfer(addr2.address, amount / 4);
                await erc20r.connect(addr1).transfer(addr3.address, amount / 2);
                await ensureMine(manualMine);

                freeze = erc20r.freeze(epoch, owner.address, index);
            });

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
                await ensureMine(manualMine);

                const frozen1 = await erc20r.frozen(addr1.address);
                const frozen2 = await erc20r.frozen(addr2.address);
                const frozen3 = await erc20r.frozen(addr3.address);

                expect(frozen1).to.equal(amount / 2);
                expect(frozen2).to.equal(Math.floor(amount / 6));
                expect(frozen3).to.equal(Math.floor(amount / 3));
            });

            it("Reverse works", async () => {
                await freeze;
                await ensureMine(manualMine);

                const logs = await erc20r.queryFilter('FreezeSuccessful');
                const { claimID } = logs[0].args;
                await erc20r.reverse(claimID);
                await ensureMine(manualMine);

                const owedBy1 = amount / 2;
                expect(await erc20r.balanceOf(addr1.address)).to.equal(0);
                const owedBy2 = Math.floor(amount / 6);
                expect(await erc20r.balanceOf(addr2.address)).to.equal(amount / 4 - owedBy2);
                const owedBy3 = Math.floor(amount / 3);
                expect(await erc20r.balanceOf(addr3.address)).to.equal(amount / 2 - owedBy3);
                expect(await erc20r.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY - amount / 4 - amount + owedBy1 + owedBy2 + owedBy3);
            })

            it('fails if still in reversible time period', async () => {
                if (manualMine) {
                    const oldTransfers = await erc20r.queryFilter('Transfer');
                    await erc20r.clean([owner.address, addr1.address], epoch);
                    const newTransfers = await erc20r.queryFilter('Transfer');
                    expect(newTransfers.length - oldTransfers.length).to.equal(0);
                } else {
                    await expect(erc20r.clean([owner.address, addr1.address], epoch)).to.be.revertedWith("ERC20-R: Block Epoch is not allowed to be cleared yet.");
                }
            });
        });
    }

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

        describe("each transaction is in a different block", function () {
            functionalTests(false);
        });

        describe('Some transactions are in the same block', function () {
            before(async function () {
                await network.provider.send("evm_setAutomine", [false]);
                await network.provider.send("evm_setIntervalMining", [50]);
            });
            functionalTests(true);
            after(async () => await network.provider.send("evm_setAutomine", [true]));
        });
    });

    describe("Some transactions are out of reversible time period", function () {
        let blockNumber;
        const amount = 100;
        let epoch;
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

            const nextThreshold = (epoch + 1) * DELTA;
            await hre.network.provider.send("hardhat_mine", ['0x' + (nextThreshold - blockNumber).toString(16)]);
        });

        it('Freeze does not work for expired transaction', async () => {
            freeze = erc20r.freeze(epoch, owner.address, 0);
            await expect(freeze).to.be.revertedWith('ERC20R: specified transaction is no longer reversible.');
        });

        it("Cleans when parameters are correct", async function () {
            const epoch = Math.floor(blockNumber / DELTA);
            const ownerSpends = erc20r.getSpenditures(epoch, owner.address);
            const addr1Spends = erc20r.getSpenditures(epoch, addr1.address);

            expect((await ownerSpends).length).to.equal(3);
            expect((await addr1Spends).length).to.equal(1);
            const clean = erc20r.clean([owner.address, addr1.address], epoch)

            const t = await clean;
            expect((await erc20r.getSpenditures(epoch, owner.address)).length).to.equal(0);
            expect((await erc20r.getSpenditures(epoch, addr1.address)).length).to.equal(0);

            const events = await erc20r.queryFilter('ClearedDataInTimeblock');
            expect(events.length).to.equal(1);
        });

        it("Fails if doesn't include all addresses for epoch", async function () {
            const epoch = Math.floor(blockNumber / DELTA);
            await expect(erc20r.clean([owner.address], epoch)).to.be.revertedWith("ERC20R: Must clear the entire block Epoch's data at once.");
            await expect(erc20r.clean([owner.address, addr2.address], epoch)).to.be.revertedWith("ERC20R: addresses to clean for block Epoch does not match the actual data storage.");
        });

    });

    describe("Test topological sort", function () {
        let epoch = 0;
        let index = 0;

        beforeEach(async function (){
            ExampleERC20R = await ethers.getContractFactory("ExampleERC20R");
            [owner, addr1, addr2, addr3] = await ethers.getSigners();
            erc20r = await ExampleERC20R.deploy(TOTAL_SUPPLY, 360, owner.address);
        });

        it("Child comes after parent.", async function () {
            await erc20r.transfer(addr1.address, 100);
            await erc20r.transfer(addr2.address, 100);
            await erc20r.connect(addr2).transfer(addr1.address, 50);

            await erc20r._getTopologicalOrder(epoch, owner.address, index);
            const orderedSuspects = (await erc20r.queryFilter('OrderedSuspectsFilled'))[0].args.orderedSuspects;
            expect(orderedSuspects.length).to.equal(3);
            expect(orderedSuspects[0]).to.equal(owner.address);
            expect(orderedSuspects[1]).to.equal(addr2.address);
            expect(orderedSuspects[2]).to.equal(addr1.address);
            
        });
    });

});
