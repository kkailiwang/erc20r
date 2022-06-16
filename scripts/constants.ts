const Web3 = require('web3');
const API_KEY = 'wss://mainnet.infura.io/ws/v3/API_KEY_HERE' //you should hide this in process.env, not here.
export const publicKey = '0x00' //you should hide this in process.env, not here.
export const web3 = new Web3(new Web3.providers.WebsocketProvider(API_KEY));
export const ERC20Raddress = '0x00'; //insert contract address here.
export const ERC20RABI = [] //insert abi here. 
export const ERC721Raddress = '0x00'; //insert contract address here.
export const ERC721RABI = [] //insert abi here. 


