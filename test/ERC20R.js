const { expect } = require("chai");
const TOTAL_SUPPLY = 1000;

describe("ERC20R", function () {

    let ExampleERC20R;
    let erc20r;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let DELTA;

    // `beforeEach` will run before each test, re-deploying the contract every
    // time. It receives a callback, which can be async.
    beforeEach(async function () {
        // Get the ContractFactory and Signers here.
        ExampleERC20R = await ethers.getContractFactory("ExampleERC20R");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // To deploy our contract, we just have to call ExampleERC20R.deploy() and await
        // for it to be deployed(), which happens once its transaction has been
        // mined.
        //for simplicity, let's make the owner the governance contract (and is able to call freeze and reverse)
        erc20r = await ExampleERC20R.deploy(TOTAL_SUPPLY, owner.address);
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

    describe("Freeze", function () {

        let blockNumber;
        const amount = 200;
        const index = 1;

        beforeEach(async function () {
            await erc20r.transfer(addrs[0].address, 100);
            const tx = await erc20r.transfer(addr1.address, amount);
            blockNumber = tx.blockNumber;
        });

        it("Freeze works on a one-node suspect graph", async function () {
            const claimID = await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, index);
            const frozen1 = await erc20r.frozen(addr1.address);
            expect(frozen1).to.equal(amount);
        });

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

        it("Freeze works on a multi-node suspect graph", async function () {
            await erc20r.connect(addr1).transfer(addr2.address, amount / 2);

            const claimID = await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, index);
            const frozen1 = await erc20r.frozen(addr1.address);
            const frozen2 = await erc20r.frozen(addr2.address);

            expect(frozen1).to.equal(await erc20r.balanceOf(addr1.address));
            expect(frozen2).to.equal(amount / 2);

        });



    });

    describe("Freeze with unequal weights", function () {
        let blockNumber;
        const amount = 200;
        const index = 1;
        beforeEach(async function () {
            await erc20r.transfer(addr1.address, amount / 4);
            const tx = await erc20r.transfer(addr1.address, amount);
            blockNumber = tx.blockNumber;
        })

        it("Freeze works on a larger suspect graph with unequal weights", async function () {
            const [addr3, addr4, addr5] = addrs;
            await erc20r.connect(addr1).transfer(addr2.address, amount / 4);
            await erc20r.connect(addr1).transfer(addr3.address, amount / 2);

            //addr1 should have amount / 2
            //addr2 should have 1/4 amount 
            //addr3 should have amount / 2

            expect(await erc20r.balanceOf(addr1.address)).to.equal(amount / 2);
            expect(await erc20r.balanceOf(addr2.address)).to.equal(amount / 4);
            expect(await erc20r.balanceOf(addr3.address)).to.equal(amount / 2);

            //frozen1 should be amount / 2
            //frozen2 shoudl be 1/3 * 1/2 * amount 
            //frozen3 should be 2/3 * 1/2 * amount 

            const claimID = await erc20r.freeze(owner.address, addr1.address, amount, blockNumber, index);
            const frozen1 = await erc20r.frozen(addr1.address);
            const frozen2 = await erc20r.frozen(addr2.address);
            const frozen3 = await erc20r.frozen(addr3.address);

            expect(frozen1).to.equal(amount / 2);
            expect(frozen2).to.equal(Math.floor(amount / 6));
            expect(frozen3).to.equal(Math.floor(amount / 3));

        });
    })
    describe("Reverse", function () {

        beforeEach(async function () {

        })

        it("Reverse works", async function () {

        });

        it("Reject Reverse", async function () {

        });
    })

    describe("clean", function () {

        beforeEach(async function () {

        })

        it("Cleans when parameters are correct", async function () {

        });

        it("Fails if doesn't include all addresses for epoch", async function () {

        });
    })
});