// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const TOTAL_SUPPLY = 1000;

const main = async () => {
    // Gets info of the account used to deploy
    const [deployer] = await hre.ethers.getSigners();
    const accountBalance = await deployer.getBalance();

    console.log('Deploying contract with account: ', deployer.address);
    console.log('Account balance: ', accountBalance.toString());

    // Read contract file
    const ExampleERC20R = await hre.ethers.getContractFactory('ExampleERC20R');

    // Triggers deployment
    //roughly 1 hour 
    const erc20r = await ExampleERC20R.deploy(TOTAL_SUPPLY, 360, '0xf4960B3bf418E0B33E3805d611DD4EDdDB5b43B0');

    // Wait for deployment to finish
    await erc20r.deployed();

    console.log('Contract deployed to address: ', erc20r.address);
};

const runMain = async () => {
    try {
        await main();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

runMain();
