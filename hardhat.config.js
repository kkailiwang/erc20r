require("@nomiclabs/hardhat-waffle");
require('dotenv').config();

const { API_URL, PRIVATE_KEY } = process.env;
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.1",
  // defaultNetwork: "rinkeby",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      mining: {
        mempool: {
          order: "fifo"
        }
      }
    },
    rinkeby: {
      allowUnlimitedContractSize: true,
      url: API_URL,
      accounts: [`0x${PRIVATE_KEY}`]
    }
  },
};
