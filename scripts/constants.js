require('dotenv').config();
"use strict";


Object.defineProperty(exports, "__esModule", { value: true });

const Web3 = require('web3');
const API_URL = process.env.API_URL; //you should hide this in process.env, not here.
exports.web3 = new Web3(new Web3.providers.WebsocketProvider(API_URL));
