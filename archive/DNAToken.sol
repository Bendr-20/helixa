// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DNAToken
 * @notice Protocol token for the AgentDNA ecosystem.
 * @dev Fixed supply, deflationary via burn mechanics.
 *      Every protocol action (mint, mutate, evolve) burns or locks $DNA.
 */
contract DNAToken is ERC20, ERC20Burnable, Ownable {

    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 1B tokens

    // Distribution addresses
    address public communityPool;      // 40% — ecosystem rewards, vested
    address public teamPool;           // 20% — 1yr cliff, 3yr vest
    address public liquidityPool;      // 15% — initial DEX liquidity
    address public treasury;           // 15% — protocol treasury
    address public advisorPool;        // 10% — advisors/early contributors

    // Staking
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public stakeTimestamp;
    uint256 public totalStaked;

    // Burn tracking
    uint256 public totalBurnedFromMints;
    uint256 public totalBurnedFromBuybacks;

    // Protocol references
    address public agentDNAContract;

    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event BurnedForMint(address indexed burner, uint256 amount);
    event BuybackBurned(uint256 amount);
    event AgentDNAContractSet(address indexed contractAddr);

    constructor(
        address _communityPool,
        address _teamPool,
        address _liquidityPool,
        address _treasury,
        address _advisorPool
    ) ERC20("AgentDNA Token", "DNA") Ownable(msg.sender) {
        communityPool = _communityPool;
        teamPool = _teamPool;
        liquidityPool = _liquidityPool;
        treasury = _treasury;
        advisorPool = _advisorPool;

        // Mint full supply to distribution pools
        _mint(_communityPool, (MAX_SUPPLY * 40) / 100);   // 400M
        _mint(_teamPool, (MAX_SUPPLY * 20) / 100);         // 200M
        _mint(_liquidityPool, (MAX_SUPPLY * 15) / 100);    // 150M
        _mint(_treasury, (MAX_SUPPLY * 15) / 100);          // 150M
        _mint(_advisorPool, (MAX_SUPPLY * 10) / 100);       // 100M
    }

    // ============================================================
    //                    BURN FOR MINT (Loop 1)
    // ============================================================

    /**
     * @notice Burn $DNA as part of AgentDNA NFT minting
     * @dev Called by users when minting an agent. Burns their $DNA.
     */
    function burnForMint(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        _burn(msg.sender, amount);
        totalBurnedFromMints += amount;
        emit BurnedForMint(msg.sender, amount);
    }

    /**
     * @notice Protocol buyback and burn (from ETH revenue)
     * @dev Owner buys $DNA from market and burns it
     */
    function buybackBurn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
        totalBurnedFromBuybacks += amount;
        emit BuybackBurned(amount);
    }

    // ============================================================
    //                    STAKING (Loop 2)
    // ============================================================

    /**
     * @notice Stake $DNA to enable agent evolution
     * @dev Staked tokens are locked and removed from circulation
     */
    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _transfer(msg.sender, address(this), amount);
        stakedBalance[msg.sender] += amount;
        stakeTimestamp[msg.sender] = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake $DNA
     * @dev Minimum 7-day lock period
     */
    function unstake(uint256 amount) external {
        require(stakedBalance[msg.sender] >= amount, "Insufficient staked balance");
        require(block.timestamp >= stakeTimestamp[msg.sender] + 7 days, "Locked for 7 days");

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;
        _transfer(address(this), msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Check if user has sufficient stake for evolution
     * @dev Agents need minimum stake to mutate/add traits
     */
    function hasMinimumStake(address user, uint256 minAmount) external view returns (bool) {
        return stakedBalance[user] >= minAmount;
    }

    // ============================================================
    //                    REPUTATION REWARDS (Loop 3)
    // ============================================================

    /**
     * @notice Distribute reputation rewards to high-performing agents
     * @dev Called by protocol to reward agents based on reputation scores
     */
    function distributeReward(address recipient, uint256 amount) external onlyOwner {
        require(balanceOf(communityPool) >= amount, "Community pool depleted");
        _transfer(communityPool, recipient, amount);
    }

    /**
     * @notice Distribute staking yield from mutation/trait fees
     * @dev Pro-rata distribution to all stakers
     */
    function distributeStakingYield(address[] calldata stakers, uint256[] calldata amounts) external onlyOwner {
        require(stakers.length == amounts.length, "Array mismatch");
        for (uint256 i = 0; i < stakers.length; i++) {
            require(stakedBalance[stakers[i]] > 0, "Not a staker");
            _transfer(treasury, stakers[i], amounts[i]);
        }
    }

    // ============================================================
    //                    GOVERNANCE (Loop 4)
    // ============================================================

    /**
     * @notice Get voting power (staked balance = voting power)
     */
    function votingPower(address account) external view returns (uint256) {
        return stakedBalance[account];
    }

    // ============================================================
    //                    ADMIN
    // ============================================================

    function setAgentDNAContract(address _contract) external onlyOwner {
        agentDNAContract = _contract;
        emit AgentDNAContractSet(_contract);
    }

    // ============================================================
    //                    VIEW
    // ============================================================

    /**
     * @notice Total supply effectively in circulation
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply() - totalStaked - balanceOf(communityPool) - balanceOf(teamPool);
    }

    /**
     * @notice Total tokens permanently removed from supply
     */
    function totalBurned() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @notice Deflationary metrics
     */
    function deflationaryMetrics() external view returns (
        uint256 burned,
        uint256 staked,
        uint256 effective_circulating,
        uint256 burn_rate_from_mints,
        uint256 burn_rate_from_buybacks
    ) {
        burned = MAX_SUPPLY - totalSupply();
        staked = totalStaked;
        effective_circulating = totalSupply() - totalStaked - balanceOf(communityPool) - balanceOf(teamPool);
        burn_rate_from_mints = totalBurnedFromMints;
        burn_rate_from_buybacks = totalBurnedFromBuybacks;
    }
}
