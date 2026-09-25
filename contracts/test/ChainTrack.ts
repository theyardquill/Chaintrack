import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

// Role enum: 1 SENDER, 2 RECEIVER, 3 AGENT
describe("ChainTrack", function () {
  async function deployFixture() {
    const [owner, sender, receiver, agent, stranger] = await hre.ethers.getSigners();

    const ChainTrack = await hre.ethers.getContractFactory("ChainTrack");
    const chainTrack = await ChainTrack.deploy();

    await chainTrack.registerUser(sender.address, "Alice Sender", "+254711000001", 1);
    await chainTrack.registerUser(receiver.address, "Bob Receiver", "+254711000002", 2);
    await chainTrack.registerUser(agent.address, "Courier Corp", "+254711000003", 3);

    return { chainTrack, sender, receiver, agent, stranger };
  }

  async function bookShipmentFixture() {
    const ctx = await loadFixture(deployFixture);
    const { chainTrack, sender } = ctx;

    const deliveryCode = "CT-2024-0912";
    const deliveryCodeHash = ethers.keccak256(ethers.toUtf8Bytes(deliveryCode));

    await chainTrack
      .connect(sender)
      .bookShipment(
        "CTK-0001",
        ethers.keccak256(ethers.toUtf8Bytes("confidential goods")),
        2,
        "M",
        2,
        deliveryCodeHash,
        "ETH",
        { value: ethers.parseEther("0.1") }
      );

    return { ...ctx, deliveryCode };
  }

  describe("registration", function () {
    it("registers users and assigns roles", async function () {
      const { chainTrack, sender } = await loadFixture(deployFixture);
      expect(await chainTrack.userIdByAddress(sender.address)).to.equal(1);
      expect((await chainTrack.users(1)).role).to.equal(1);
    });

    it("rejects non-owner registrations", async function () {
      const { chainTrack, stranger } = await loadFixture(deployFixture);
      await expect(
        chainTrack.connect(stranger).registerUser(stranger.address, "X", "0", 1)
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("booking + escrow", function () {
    it("creates a package and holds the escrow", async function () {
      const { chainTrack } = await loadFixture(bookShipmentFixture);

      expect(await chainTrack.packageCtr()).to.equal(1);
      const pkg = await chainTrack.packages(1);
      expect(pkg.qrHash).to.equal("CTK-0001");
      expect(pkg.senderId).to.equal(1);
      expect(pkg.receiverId).to.equal(2);
      expect(pkg.status).to.equal(0); // Registered

      const txns = await chainTrack.getTransaction(1);
      expect(txns.status).to.equal(1); // InEscrow

      expect(
        await ethers.provider.getBalance(await chainTrack.getAddress())
      ).to.equal(ethers.parseEther("0.1"));
    });

    it("rejects bookings from unregistered addresses", async function () {
      const { chainTrack, stranger } = await loadFixture(deployFixture);
      await expect(
        chainTrack
          .connect(stranger)
          .bookShipment("CTK-9999", "0xhash", 1, "S", 2, ethers.ZeroHash, "ETH", {
            value: ethers.parseEther("0.01"),
          })
      ).to.be.revertedWith("Not registered");
    });

    it("indexes packages by QR code", async function () {
      const { chainTrack } = await loadFixture(bookShipmentFixture);
      expect(await chainTrack.packageIdByCode("CTK-0001")).to.equal(1);
    });

    it("rejects duplicate QR codes", async function () {
      const { chainTrack, sender } = await loadFixture(bookShipmentFixture);
      await expect(
        chainTrack
          .connect(sender)
          .bookShipment(
            "CTK-0001",
            ethers.keccak256(ethers.toUtf8Bytes("another")),
            1,
            "S",
            2,
            ethers.ZeroHash,
            "ETH",
            { value: ethers.parseEther("0.01") }
          )
      ).to.be.revertedWith("QR code already booked");
    });
  });

  describe("checkpoint logging", function () {
    it("moves a package through in-transit checkpoints", async function () {
      const { chainTrack, agent } = await loadFixture(bookShipmentFixture);

      await chainTrack.connect(agent).logCheckpoint(1, "Nairobi Hub", 1);
      await expect(
        chainTrack.connect(agent).logCheckpoint(1, "JKIA Cargo", 2)
      )
        .to.emit(chainTrack, "CheckpointLogged")
        .withArgs(2, 1, "JKIA Cargo", anyValue);

      const checkpoints = await chainTrack.getCheckpoints(1);
      expect(checkpoints.length).to.equal(2);
      expect((await chainTrack.packages(1)).status).to.equal(2); // OutForDelivery
    });

    it("rejects non-agents", async function () {
      const { chainTrack, stranger } = await loadFixture(bookShipmentFixture);
      await expect(
        chainTrack.connect(stranger).logCheckpoint(1, "Nairobi Hub", 1)
      ).to.be.revertedWith("Not registered");
    });
  });

  describe("escrow release", function () {
    it("releases funds to the sender after the recipient confirms", async function () {
      const { chainTrack, sender, agent, deliveryCode } = await loadFixture(bookShipmentFixture);

      await chainTrack.connect(agent).logCheckpoint(1, "Nairobi Hub", 1);
      await chainTrack.connect(agent).logCheckpoint(1, "Destination", 2);

      const senderBefore = await ethers.provider.getBalance(sender.address);
      const receiptHash = ethers.keccak256(ethers.toUtf8Bytes("POD receipt v1"));

      await expect(
        chainTrack.connect((await ethers.getSigners())[2]).confirmDelivery(1, "wrong-code", receiptHash)
      ).to.be.revertedWith("Invalid delivery code");

      await expect(
        chainTrack.connect((await ethers.getSigners())[2]).confirmDelivery(1, deliveryCode, receiptHash)
      ).to.emit(chainTrack, "EscrowReleased");

      expect((await chainTrack.packages(1)).status).to.equal(3); // Delivered
      expect((await chainTrack.getTransaction(1)).status).to.equal(2); // Paid
      expect(await chainTrack.getReceiptHash(1)).to.equal(receiptHash);

      const senderAfter = await ethers.provider.getBalance(sender.address);
      expect(senderAfter).to.be.gt(senderBefore);

      // Contract holds no funds anymore.
      expect(
        await ethers.provider.getBalance(await chainTrack.getAddress())
      ).to.equal(0);
    });

    it("records the agent receipt when the carrier marks delivery, then releases escrow on receiver confirm", async function () {
      const { chainTrack, sender, receiver, agent, deliveryCode } = await loadFixture(bookShipmentFixture);
      const receiptHash = ethers.keccak256(ethers.toUtf8Bytes("POD agent v1"));

      await chainTrack.connect(agent).logCheckpoint(1, "Nairobi Hub", 1);
      await chainTrack.connect(agent).logCheckpoint(1, "Destination", 2);
      await chainTrack.connect(agent).logCheckpoint(1, "Recipient door", 3); // Delivered

      await expect(
        chainTrack.connect(agent).recordReceipt(1, receiptHash)
      ).to.emit(chainTrack, "ReceiptRecorded");

      // First hash wins; the receiver's confirm must not overwrite it.
      const otherHash = ethers.keccak256(ethers.toUtf8Bytes("other"));
      await expect(
        chainTrack.connect(receiver).confirmDelivery(1, deliveryCode, otherHash)
      ).to.emit(chainTrack, "EscrowReleased");

      expect(await chainTrack.getReceiptHash(1)).to.equal(receiptHash);
      expect((await chainTrack.getTransaction(1)).status).to.equal(2); // Paid
      expect((await ethers.provider.getBalance(sender.address))).to.be.gt(0);
    });

    it("lets the sender cancel and be refunded before pickup", async function () {
      const { chainTrack, sender } = await loadFixture(bookShipmentFixture);

      const before = await ethers.provider.getBalance(sender.address);
      await expect(chainTrack.connect(sender).cancelShipment(1)).to.not.be.reverted;

      const after = await ethers.provider.getBalance(sender.address);
      expect(after).to.be.gt(before);
      expect((await chainTrack.packages(1)).status).to.equal(5); // Cancelled
      expect((await chainTrack.getTransaction(1)).status).to.equal(3); // Refunded
    });
  });
});