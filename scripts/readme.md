# Auxiliary off-chain scripts 
`clean20R.ts`, `clean721R.ts`, `find_index20R.ts`, and `find_index721R.ts` serve as example scripts that interact with the ERC20R and ERC721R standards. 
## `clean` scripts
Both standards store recent transaction history, so that they can verify a freeze request. However, that data cannot stay in the memory forever due to gas costs and longevity. Thus, an off-chain script must periodically call `clean` on the standards. 
## `find_index` scripts
As you may have noticed, the `freeze` functions in both ERC-20R and ERC-721R require a parameter `index`, which represents the index of the contested transaction within the contract's memory. In order to supply the right `index`, the caller must have read the contract's memory first. The find_index scripts do just that and find the right index given the transaction ID that the victim is calling a freeze request on. 