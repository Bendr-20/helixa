// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IHelixaV2 {
    function mint(address to) external payable returns (uint256);
}

/**
 * @title HelixaMintGate
 * @notice Signature-gated minting wrapper for HelixaV2.
 *         Requires a valid server signature to mint.
 *         Server issues signatures after payment is confirmed (x402, ETH, USDC, CRED, fiat).
 */
contract HelixaMintGate {
    IHelixaV2 public immutable helixa;
    address public owner;
    address public signer;

    mapping(bytes32 => bool) public usedNonces;
    mapping(address => uint256) public mintCount;
    uint256 public maxMintsPerWallet = 5;

    event Minted(address indexed to, uint256 tokenId, bytes32 nonce, string paymentMethod);
    event SignerUpdated(address oldSigner, address newSigner);
    event OwnershipTransferred(address oldOwner, address newOwner);

    error InvalidSignature();
    error NonceAlreadyUsed();
    error SignatureExpired();
    error MintLimitReached();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _helixa, address _signer) {
        helixa = IHelixaV2(_helixa);
        signer = _signer;
        owner = msg.sender;
    }

    function mintWithSignature(
        address to,
        bytes32 nonce,
        uint256 expiry,
        string calldata paymentRef,
        bytes calldata signature
    ) external returns (uint256) {
        if (block.timestamp > expiry) revert SignatureExpired();
        if (usedNonces[nonce]) revert NonceAlreadyUsed();
        if (mintCount[to] >= maxMintsPerWallet) revert MintLimitReached();

        bytes32 messageHash = keccak256(abi.encodePacked(
            to, nonce, expiry, paymentRef, block.chainid, address(this)
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", messageHash
        ));

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        address recovered = ecrecover(ethSignedHash, v, r, s);
        if (recovered != signer) revert InvalidSignature();

        usedNonces[nonce] = true;
        mintCount[to]++;

        uint256 tokenId = helixa.mint(to);
        emit Minted(to, tokenId, nonce, paymentRef);
        return tokenId;
    }

    function _splitSignature(bytes calldata sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        r = bytes32(sig[0:32]);
        s = bytes32(sig[32:64]);
        v = uint8(sig[64]);
    }

    function setSigner(address _signer) external onlyOwner {
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function setMaxMintsPerWallet(uint256 _max) external onlyOwner {
        maxMintsPerWallet = _max;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
