const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HelixaMintGate", function () {
  let mintGate, mockHelixa, owner, signer, user;
  let signerWallet;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Create a dedicated signer wallet
    signerWallet = ethers.Wallet.createRandom().connect(ethers.provider);

    // Deploy mock HelixaV2
    const MockHelixa = await ethers.getContractFactory("MockHelixaV2");
    mockHelixa = await MockHelixa.deploy();

    // Deploy MintGate
    const MintGate = await ethers.getContractFactory("HelixaMintGate");
    mintGate = await MintGate.deploy(await mockHelixa.getAddress(), signerWallet.address);
  });

  async function generateSignature(to, nonce, expiry, paymentRef) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const gateAddress = await mintGate.getAddress();

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "bytes32", "uint256", "string", "uint256", "address"],
      [to, nonce, expiry, paymentRef, chainId, gateAddress]
    );
    return signerWallet.signMessage(ethers.getBytes(messageHash));
  }

  it("should mint with valid signature", async function () {
    const to = user.address;
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 300;
    const paymentRef = "x402:test:123";

    const sig = await generateSignature(to, nonce, expiry, paymentRef);

    await expect(mintGate.mintWithSignature(to, nonce, expiry, paymentRef, sig))
      .to.emit(mintGate, "Minted");
  });

  it("should reject expired signature", async function () {
    const to = user.address;
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) - 100; // expired
    const paymentRef = "x402:test:456";

    const sig = await generateSignature(to, nonce, expiry, paymentRef);

    await expect(mintGate.mintWithSignature(to, nonce, expiry, paymentRef, sig))
      .to.be.revertedWithCustomError(mintGate, "SignatureExpired");
  });

  it("should reject replayed nonce", async function () {
    const to = user.address;
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 300;
    const paymentRef = "x402:test:789";

    const sig = await generateSignature(to, nonce, expiry, paymentRef);

    await mintGate.mintWithSignature(to, nonce, expiry, paymentRef, sig);

    await expect(mintGate.mintWithSignature(to, nonce, expiry, paymentRef, sig))
      .to.be.revertedWithCustomError(mintGate, "NonceAlreadyUsed");
  });

  it("should reject invalid signer", async function () {
    const to = user.address;
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 300;
    const paymentRef = "x402:test:000";

    // Sign with wrong wallet
    const fakeWallet = ethers.Wallet.createRandom();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const gateAddress = await mintGate.getAddress();
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "bytes32", "uint256", "string", "uint256", "address"],
      [to, nonce, expiry, paymentRef, chainId, gateAddress]
    );
    const fakeSig = await fakeWallet.signMessage(ethers.getBytes(messageHash));

    await expect(mintGate.mintWithSignature(to, nonce, expiry, paymentRef, fakeSig))
      .to.be.revertedWithCustomError(mintGate, "InvalidSignature");
  });

  it("should enforce mint limit per wallet", async function () {
    await mintGate.setMaxMintsPerWallet(1);

    const to = user.address;
    const nonce1 = ethers.hexlify(ethers.randomBytes(32));
    const nonce2 = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 300;

    const sig1 = await generateSignature(to, nonce1, expiry, "x402:test:a");
    const sig2 = await generateSignature(to, nonce2, expiry, "x402:test:b");

    await mintGate.mintWithSignature(to, nonce1, expiry, "x402:test:a", sig1);

    await expect(mintGate.mintWithSignature(to, nonce2, expiry, "x402:test:b", sig2))
      .to.be.revertedWithCustomError(mintGate, "MintLimitReached");
  });
});
