// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "hardhat/console.sol";

/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 * For a generic mechanism see {ERC20PresetMinterPauser}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC20
 * applications.
 *
 * Additionally, an {Approval} event is emitted on calls to {transferFrom}.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 *
 * Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
 * functions have been added to mitigate the well-known issues around setting
 * allowances. See {IERC20-approve}.
 */
contract ERC20R is Context, IERC20, IERC20Metadata {
    mapping(address => uint256) private _balances;
    mapping(address => uint256) public frozen;
    mapping(uint256 => mapping(address => Spenditure[])) private _spenditures;
    mapping(bytes32 => Spenditure[]) private _claimToDebts;
    mapping(uint256 => uint256) private _numAddressesInEpoch;

    modifier onlyGovernance() {
        require(
            msg.sender == _governanceContract,
            "ERC721R: Unauthorized call."
        );
        _;
    }

    uint256 public DELTA = 1000;
    uint256 public NUM_REVERSIBLE_BLOCKS;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    address private _governanceContract;

    string private _name;
    string private _symbol;

    struct Spenditure {
        address from;
        address to;
        uint256 amount;
        uint256 block_number;
    }

    event ClearedDataInTimeblock(uint256 length, uint256 blockNum);
    event FreezeSuccessful(
        address from,
        address to,
        uint256 amount,
        uint256 blockNumber,
        uint256 index,
        bytes32 claimID
    );
    event ReverseSuccessful(bytes32 claimID);
    event ReverseRejected(bytes32 claimID);

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * The default value of {decimals} is 18. To select a different value for
     * {decimals} you should overload it.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 reversiblePeriod_,
        address governanceContract_
    ) {
        _name = name_;
        _symbol = symbol_;
        NUM_REVERSIBLE_BLOCKS = reversiblePeriod_;
        _governanceContract = governanceContract_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses, unless this function is
     * overridden;
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address to, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    function _getSuspectTxsFromAddress(address from, uint256 startBlock)
        private
        returns (Spenditure[] memory suspects,
                 uint256 sum,
                 uint256 burned,
                 uint256 counter)
    {
        uint256 startEpoch = startBlock / DELTA;
        uint256 startEpochLength = _spenditures[startEpoch][from].length;
        uint256 index = find_internal(
            startEpoch,
            from,
            0,
            startEpochLength,
            startBlock
        );
        uint256 n = 0;
        sum = 0;

        uint256 lastEpoch = block.number / DELTA;
        if (
            index !=
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ) {
            n += startEpochLength - index;
        }

        for (uint256 i = startEpoch + 1; i < lastEpoch; i++) {
            n += _spenditures[i][from].length;
        }
        suspects = new Spenditure[](n);

        if (
            index !=
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ) {
            for (index; index < startEpochLength; index++) {
                Spenditure memory curr = _spenditures[startEpoch][from][index];
                if (curr.to != address(0)){
                    suspects[counter] = Spenditure(
                        curr.from,
                        curr.to,
                        curr.amount,
                        curr.block_number
                    );
                    sum += _spenditures[startEpoch][from][index].amount;
                    counter++;
                } else { // this is a burn transaction
                    burned += _spenditures[startEpoch][from][index].amount;
                }
            }
        }
        for (uint256 i = startEpoch + 1; i < lastEpoch; i++) {
            for (uint256 j = 0; j < _spenditures[i][from].length; j++) {
                Spenditure memory curr = _spenditures[i][from][j];
                if (curr.to != address(0)){
                    suspects[counter] = curr;
                    sum += _spenditures[i][from][j].amount;
                    counter++;
                } else { // this is a burn transaction
                    burned += curr.amount;
                }
            }  
        }
    }

    function _freeze_helper(Spenditure memory s, bytes32 claimID) private {
        uint256 advBalance = _balances[s.to] - frozen[s.to];
        if (s.amount <= advBalance) {
            frozen[s.to] += s.amount;
            _claimToDebts[claimID].push(s);
        } else {
            frozen[s.to] += advBalance;
            _claimToDebts[claimID].push(
                Spenditure(s.from, s.to, advBalance, s.block_number)
            );
            (
                Spenditure[] memory suspects,
                uint256 totalAmounts,
                uint256 totalBurned,
                uint256 validLength
            ) = _getSuspectTxsFromAddress(s.to, s.block_number + 1);
            if (totalAmounts > 0){
                uint256 leftover = s.amount - advBalance;
                if (leftover >= totalBurned){
                    leftover -= totalBurned;
                } else {
                    return; // all leftover are burned
                }
                if (leftover <= 0){
                    return;
                }
                for (uint256 i = 0; i < validLength; i++) {
                    //responsible amount is weighted
                    Spenditure memory s_next = Spenditure(
                        s.from,
                        suspects[i].to,
                        (leftover * suspects[i].amount) / totalAmounts,
                        suspects[i].block_number
                    );
                    _freeze_helper(s_next, claimID);
                }
            } // possible that one address burns a lot of tokens that totalAmounts <= 0
            
        }
    }

    //binary search
    function find_internal(
        uint256 epoch,
        address from,
        uint256 begin,
        uint256 end,
        uint256 lowerBound
    ) internal returns (uint256 ret) {
        uint256 len = end - begin;
        if (len == 0) {
            return
                _spenditures[epoch][from].length > begin &&
                    _spenditures[epoch][from][begin].block_number >= lowerBound
                    ? begin
                    : 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        }
        uint256 mid = begin + len / 2;
        uint256 v = _spenditures[epoch][from][mid].block_number;
        if (lowerBound < v)
            return find_internal(epoch, from, begin, mid, lowerBound);
        else if (lowerBound > v)
            return find_internal(epoch, from, mid + 1, end, lowerBound);
        else {
            while (
                mid > 0 &&
                _spenditures[epoch][from][mid - 1].block_number == lowerBound
            ) {
                mid--;
            }
            return mid;
        }
    }

    //amount should be in wei
    function freeze(
        uint256 epoch,
        address from,
        uint256 index
    ) public onlyGovernance returns (bytes32 claimID) {
        // get transaction info
        uint256 epochLength = _spenditures[epoch][from].length;
        require(
            index >= 0 && index < epochLength,
            "ERC20R: Invalid index provided."
        );
        Spenditure storage s = _spenditures[epoch][from][index];
        uint256 blockNumber = s.block_number;
        address to = s.to;
        uint256 amount = s.amount;
        if (block.number > NUM_REVERSIBLE_BLOCKS) {
            require(
                blockNumber >= block.number - NUM_REVERSIBLE_BLOCKS,
                "ERC20R: specified transaction is no longer reversible."
            );
        }
        
        //hash the spenditure; this is the claim hash now. what about two identical
        claimID = keccak256(abi.encode(s));
        _freeze_helper(s, claimID);
        emit FreezeSuccessful(from, to, amount, blockNumber, index, claimID);
    }

    function reverse(bytes32 claimID) external onlyGovernance {
        //go through all of _claimToDebts[tx_va0] and transfer
        for (uint256 i = 0; i < _claimToDebts[claimID].length; i++) {
            Spenditure storage s = _claimToDebts[claimID][i];
            frozen[s.to] -= s.amount;
            _transfer(s.to, s.from, s.amount);
        }
        delete _claimToDebts[claimID];
        emit ReverseSuccessful(claimID);
    }

    function rejectReverse(bytes32 claimID) external onlyGovernance {
        for (uint256 i = 0; i < _claimToDebts[claimID].length; i++) {
            Spenditure storage s = _claimToDebts[claimID][i];
            frozen[s.to] -= s.amount;
            delete _claimToDebts[claimID];
        }
        emit ReverseRejected(claimID);
    }

    function clean(address[] calldata addresses, uint256 epoch) external {
        //requires you to clear all of it.
        require(
            block.number > NUM_REVERSIBLE_BLOCKS &&
                (epoch + 1) * DELTA - 1 < block.number - NUM_REVERSIBLE_BLOCKS,
            "ERC20-R: Block Epoch is not allowed to be cleared yet."
        );
        require(
            _numAddressesInEpoch[epoch] == addresses.length,
            "ERC20R: Must clear the entire block Epoch's data at once."
        );
        for (uint256 i = 0; i < addresses.length; i++) {
            //require it to have data, not empty arrary
            require(
                _spenditures[epoch][addresses[i]].length > 0,
                "ERC20R: addresses to clean for block Epoch does not match the actual data storage."
            );
            delete _spenditures[epoch][addresses[i]];
        }
        _numAddressesInEpoch[epoch] = 0;
        emit ClearedDataInTimeblock(addresses.length, epoch);
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `amount`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `amount`.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue)
        public
        virtual
        returns (bool)
    {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        virtual
        returns (bool)
    {
        address owner = _msgSender();
        uint256 currentAllowance = allowance(owner, spender);
        require(
            currentAllowance >= subtractedValue,
            "ERC20: decreased allowance below zero"
        );
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    /**
     * @dev Moves `amount` of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `from` must have a balance of at least `amount`.
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(from, to, amount);

        uint256 fromBalance = _balances[from];
        require(
            fromBalance >= amount,
            "ERC20: transfer amount exceeds balance"
        );
        uint256 amountRemaining = fromBalance - amount;
        require(
            amountRemaining >= frozen[from],
            "ERC20R: Cannot spend frozen money in account."
        );

        unchecked {
            _balances[from] = fromBalance - amount;
        }
        _balances[to] += amount;

        uint256 epoch = block.number / DELTA;
        if (_spenditures[epoch][from].length == 0) {
            //new value stored for mapping
            _numAddressesInEpoch[epoch] += 1;
        }

        _spenditures[epoch][from].push(
            Spenditure(from, to, amount, block.number)
        );

        emit Transfer(from, to, amount);

        _afterTokenTransfer(from, to, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    /**
    * @dev Destroys `amount` tokens from the caller.
    *
    */
    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` unfrozen tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20R: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account] - frozen[account];
        require(accountBalance >= amount, "ERC20R: burn amount exceeds unfrozen balance");
        unchecked {
            _balances[account] = _balances[account] - amount;
        }
        _totalSupply -= amount;

        uint256 epoch = block.number / DELTA;
        _spenditures[epoch][account].push(
            Spenditure(account, address(0), amount, block.number)
        );

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Updates `owner` s allowance for `spender` based on spent `amount`.
     *
     * Does not update the allowance amount in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Might emit an {Approval} event.
     */
    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "ERC20: insufficient allowance"
            );
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    /**
     * @dev Hook that is called after any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * has been transferred to `to`.
     * - when `from` is zero, `amount` tokens have been minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens have been burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function getSpenditures(uint256 epoch, address from)
        external
        view
        returns (Spenditure[] memory)
    {
        return _spenditures[epoch][from];
    }
}
