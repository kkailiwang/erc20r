# How to deploy (rinkeby)
from main directory of this project: 
1. add a `.env` file with your `API_URL` and `PRIVATE_KEY`
2. `npm i`
3. `npx hardhat compile` 
4. Replace your constructor arguments in the deploy js file with your own 
5. `npx hardhat run scripts/deploy20R.js --network rinkeby` (replace "20R" with "721R" if deploying 721R)
6. Copy the address that it deployed to, then go to https://rinkeby.etherscan.io/address/{address}
7. `bash hardhat-scripts/flatten20R.sh`
8. On etherscan, verify your contract using the flattened code from `deployment/flatERC20R.sol`