// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";

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
    mapping(address => uint256) private _frozen;
    mapping(uint256 => mapping(address => Spenditure[])) private _spenditures;
    mapping(bytes32 => Spenditure[]) private _claimToDebts;
    mapping(uint256 => uint256) private _numAddressesInEra;

    modifier governanceOnly() {
        require(
            msg.sender == _governanceContract,
            "ERC721R: Unauthorized call."
        );
        _;
    }

    uint256 private DELTA = 1000;
    uint256 private NUM_REVERSIBLE_BLOCKS;

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
        returns (Spenditure[] memory suspects, uint256 sum)
    {
        uint256 startBlockEra = startBlock / DELTA;
        uint256 startEraLength = _spenditures[startBlockEra][from].length;
        uint256 index = find_internal(
            startBlockEra,
            from,
            0,
            startEraLength,
            startBlock
        );
        sum = 0;
        uint256 n = startEraLength - index;
        uint256 lastEra = block.number / DELTA;

        for (uint256 i = startBlockEra + 1; i < lastEra; i++) {
            n += _spenditures[i][from].length;
        }
        suspects = new Spenditure[](n);
        uint256 counter = 0;
        for (index; index < startEraLength; index++) {
            Spenditure memory curr = _spenditures[startBlockEra][from][index];
            suspects[counter] = Spenditure(
                curr.from,
                curr.to,
                curr.amount,
                curr.block_number
            );
            sum += _spenditures[startBlockEra][from][index].amount;
            counter++;
        }
        for (uint256 i = startBlockEra + 1; i < lastEra; i++) {
            for (uint256 j = 0; j < _spenditures[i][from].length; j++) {
                suspects[counter] = _spenditures[i][from][j];
                sum += _spenditures[i][from][j].amount;
            }
            counter++;
        }
    }

    function _freeze_helper(Spenditure memory s, bytes32 claimID) private {
        uint256 advBalance = _balances[s.to];
        if (s.amount < advBalance) {
            _frozen[s.to] += s.amount;
            _claimToDebts[claimID].push(s);
        } else {
            _frozen[s.from] += advBalance;
            _claimToDebts[claimID].push(
                Spenditure(s.from, s.to, advBalance, s.block_number)
            );
            (
                Spenditure[] memory suspects,
                uint256 totalAmounts
            ) = _getSuspectTxsFromAddress(s.to, s.block_number + 1);
            for (uint256 i = 0; i < suspects.length; i++) {
                //responsible amount is weighted
                Spenditure memory s_next = Spenditure(
                    suspects[i].from,
                    suspects[i].to,
                    suspects[i].amount / totalAmounts,
                    suspects[i].block_number
                );
                _freeze_helper(s_next, claimID);
            }
        }
    }

    //binary search
    function find_internal(
        uint256 blockEra,
        address from,
        uint256 begin,
        uint256 end,
        uint256 value
    ) internal returns (uint256 ret) {
        uint256 len = end - begin;
        if (
            len == 0 ||
            (len == 1 &&
                _spenditures[blockEra][from][begin].block_number != value)
        ) {
            return
                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        }
        uint256 mid = begin + len / 2;
        uint256 v = _spenditures[blockEra][from][mid].block_number;
        if (value < v) return find_internal(blockEra, from, begin, mid, value);
        else if (value > v)
            return find_internal(blockEra, from, mid + 1, end, value);
        else {
            while (
                mid - 1 >= 0 &&
                _spenditures[blockEra][from][mid - 1].block_number == value
            ) {
                mid--;
            }
            return mid;
        }
    }

    //amount should be in wei
    function freeze(
        address from,
        address to,
        uint256 amount,
        uint256 blockNumber,
        uint256 index
    ) public governanceOnly returns (bytes32 claimID) {
        require(
            blockNumber >= block.number - NUM_REVERSIBLE_BLOCKS,
            "ERC20R: specified transaction is no longer reversible."
        );
        require(
            blockNumber <= block.number,
            "ERC20R: specified transaction block number is greater than the current block number."
        );

        //verify that this transaction happened
        uint256 blockEra = blockNumber / DELTA;
        uint256 blockEraLength = _spenditures[blockEra][from].length;
        // do binary search for it
        require(
            index >= 0 && index < blockEraLength,
            "ERC20R: Invalid index provided."
        );
        require(
            _spenditures[blockEra][from][index].to == to &&
                _spenditures[blockEra][from][index].amount == amount,
            "ERC20R: index given does not match spenditure"
        );
        //hash the spenditure; this is the claim hash now. what about two identical
        Spenditure storage s = _spenditures[blockEra][from][index];
        claimID = keccak256(abi.encode(s));
        _freeze_helper(s, claimID);
    }

    function reverse(bytes32 claimID, bool approved) public governanceOnly {
        //go through all of _claimToDebts[tx_va0] and transfer
        for (uint256 i = 0; i < _claimToDebts[claimID].length; i++) {
            Spenditure storage s = _claimToDebts[claimID][i];
            _frozen[s.from] -= s.amount;
            if (approved) {
                transferFrom(s.to, s.from, s.amount);
            }
            delete _claimToDebts[claimID];
        }
    }

    //gelato network - runs daily batches

    function clean(address[] calldata addresses, uint256 blockEra) external {
        //requires you to clear all of it.
        require(
            (blockEra + 1) * DELTA - 1 < block.number - NUM_REVERSIBLE_BLOCKS,
            "ERC20-R: Block era is not allowed to be cleared yet."
        );
        require(
            _numAddressesInEra[blockEra] == addresses.length,
            "ERC20R: Must clear the entire block era's data at once."
        );
        for (uint256 i = 0; i < addresses.length; i++) {
            //require it to have data, not empty arrary
            require(
                _spenditures[blockEra][addresses[i]].length > 0,
                "ERC20R: addresses to clean for block era does not match the actual data storage."
            );
            delete _spenditures[blockEra][addresses[i]];
        }
        _numAddressesInEra[blockEra] = 0;
        emit ClearedDataInTimeblock(addresses.length, blockEra);
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
            amountRemaining > _frozen[from],
            "ERC20R: Cannot spend frozen money in account."
        );

        unchecked {
            _balances[from] = fromBalance - amount;
        }
        _balances[to] += amount;

        uint256 blockEra = block.number / DELTA;
        if (_spenditures[blockEra][from].length == 0) {
            //new value stored for mapping
            _numAddressesInEra[blockEra] += 1;
        }

        _spenditures[blockEra][from].push(
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
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

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
}
