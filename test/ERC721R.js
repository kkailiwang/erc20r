const { expect } = require("chai");
const TOTAL_SUPPLY = 10;

describe("ERC721R", function () {

    let ExampleERC721R;
    let erc721r;
    let owner;
    let addr1;
    let addr2;
    let addr3;

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

                // This test expects the owner variable stored in the contract to be equal
                // to our Signer's owner.
                for (let i=0; i<TOTAL_SUPPLY; i++){
                    expect(await erc721r.ownerOf(i)).to.equal(owner.address);
                }
            });
        });

        describe("Transactions", function () {
            let blockNumber;

            it("Should transfer tokens between accounts and update _owners", async function () {
                // Transfer token 0 from owner to addr1
                let tokenId = 0;
                const tx = await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                blockNumber = tx.blockNumber;
                const token0Owner = await erc721r.ownerOf(tokenId);
                expect(token0Owner).to.equal(addr1.address);

                // Transfer token 0 from addr1 to addr2
                // We use .connect(signer) to send a transaction from another account
                await erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, tokenId);
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

            let blockNumber;
            const tokenId = 0;
            const index = 1;

            beforeEach(async function () {
                await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                const tx = await erc721r.connect(addr1).transferFrom(addr1.address, addr3.address, tokenId);
                blockNumber = tx.blockNumber;
            });

            it("Freeze works on a one-node suspect graph", async function () {
                await erc721r.freeze(addr1.address, addr3.address, tokenId, blockNumber, index);
                const frozen0 = await erc721r._frozen(tokenId);
                expect(frozen0).to.equal(true);
            });

            it("Freeze fails if wrong index provided, or out of range", async () => {
                await expect(erc721r.freeze(addr1.address, addr3.address, tokenId, blockNumber, 0)).to.be.revertedWith("ERC721R: Index does not match the contested ownership.");
                await expect(erc721r.freeze(addr1.address, addr3.address, tokenId, blockNumber, 10)).to.be.revertedWith("ERC721R: Verification of specified transaction failed.")
            });

            it("Account cannot transfer frozen token", async function () {
                await erc721r.freeze(addr1.address, addr3.address, tokenId, blockNumber, index);
                //addr1 is not allowed to send tokens now. 
                await expect(
                    erc721r.connect(addr3).transferFrom(addr3.address, addr2.address, tokenId)
                ).to.be.revertedWith("ERC721R: transfer frozen token");

                //can still receive other tokens
                let otherToken = 1;
                await erc721r.transferFrom(owner.address, addr1.address, otherToken);

                //can still send other token
                await erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, otherToken);
                expect(await erc721r.ownerOf(otherToken)).to.equal(addr2.address);

                //cannot spend a token you do not own
                await expect(
                    erc721r.connect(addr1).transferFrom(addr1.address, addr2.address, otherToken)
                ).to.be.revertedWith("ERC721R: transfer caller is not owner nor approved");
            })

            it("Reverse works", async function () {
                const freeze = erc721r.freeze(addr1.address, addr3.address, tokenId, blockNumber, index);
                expect(freeze).to.emit(erc721r, 'FreezeSuccessful');
                await freeze;
                const freezes = await erc721r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const victim = freezes[0].args.from;
                const reverse = erc721r.reverse(tokenId, victim);
                expect(reverse).to.emit(erc721r, 'ReverseSuccessful');
                await reverse;
                const ownerOf0 = await erc721r.ownerOf(tokenId);
                expect(ownerOf0).to.equal(addr1.address);
            });

            it("Reject Reverse works", async function () {
                const freeze = erc721r.freeze(addr1.address, addr3.address, tokenId, blockNumber, index);
                expect(freeze).to.emit(erc721r, 'FreezeSuccessful');
                await freeze;
                const freezes = await erc721r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const reverse = erc721r.rejectReverse(tokenId);
                expect(reverse).to.emit(erc721r, 'ReverseRejected');
                await reverse;
                const ownerOf0 = await erc721r.ownerOf(tokenId);
                expect(ownerOf0).to.equal(addr3.address);
                const frozen0 = await erc721r._frozen(tokenId);
                expect(frozen0).to.equal(false);
            });
        });

        describe("multi-node graph", function () {
            let blockNumber;
            const tokenId = 0;
            const index = 0;

            beforeEach(async function () {
                const tx = await erc721r.transferFrom(owner.address, addr1.address, tokenId);
                blockNumber = tx.blockNumber;
                await erc721r.connect(addr1).transferFrom(addr1.address, addr3.address, tokenId);
                
            });

            it("Freeze works on a multi-node suspect graph", async function () {
                const freeze = erc721r.freeze(owner.address, addr1.address, tokenId, blockNumber, index);
                expect(freeze).to.emit('FreezeSuccessful');
                await freeze;
                const frozen0 = await erc721r._frozen(tokenId);
                expect(frozen0).to.equal(true);
            });

            it("Reverse works on a multi-node suspect graph", async function () {
                const freeze = erc721r.freeze(owner.address, addr1.address, tokenId, blockNumber, index);
                expect(freeze).to.emit('FreezeSuccessful');
                await freeze;
                const freezes = await erc721r.queryFilter('FreezeSuccessful');
                expect(freezes.length).to.equal(1);
                const reverse = erc721r.reverse(tokenId, owner.address);
                expect(reverse).to.emit(erc721r, 'ReverseSuccessful');
                await reverse;
                const ownerOf0 = await erc721r.ownerOf(tokenId);
                expect(ownerOf0).to.equal(owner.address);
            });
        });
    });

    describe("Some transactions are out of reversible time period", function () {
        
    });
});