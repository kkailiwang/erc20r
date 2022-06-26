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
            let NUM_REVERSIBLE_BLOCKS = await erc721r.NUM_REVERSIBLE_BLOCKS();
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
    });

});