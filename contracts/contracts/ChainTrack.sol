// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChainTrack
/// @notice Blockchain-backed shipping tracking with smart-contract escrow.
/// @dev Adapted from the SupplyChain pattern (role-gated on-chain stages, keccak
///      integrity, QR-per-package) to the ChainTrack entity model:
///      USER, PACKAGE, TRANSACTION (escrow), CHECKPOINT.
contract ChainTrack {
    address public owner;

    event UserRegistered(uint256 indexed userId, Role indexed role, address indexed addr, string name);
    event PackageBooked(
        uint256 indexed packageId,
        string qrHash,
        uint256 indexed senderId,
        uint256 indexed receiverId,
        uint256 amount,
        string currency
    );
    event CheckpointLogged(uint256 indexed checkpointId, uint256 indexed packageId, string location, PackageStatus status);
    event DeliveryConfirmed(uint256 indexed packageId, uint256 indexed confirmedBy);
    event EscrowReleased(uint256 indexed txnId, uint256 indexed packageId, address indexed payee, uint256 amount);

    enum Role {
        NONE,
        SENDER,
        RECEIVER,
        AGENT
    }

    enum PackageStatus {
        Registered,
        InTransit,
        OutForDelivery,
        Delivered,
        Failed,
        Cancelled
    }

    enum TxnStatus {
        Pending,
        InEscrow,
        Paid,
        Refunded,
        Cancelled
    }

    struct User {
        address addr;
        uint256 id;
        string name;
        string phone;
        Role role;
        bool active;
    }

    struct Package {
        uint256 id;
        string qrHash;
        string contentHash;
        uint256 weight;
        string size;
        uint256 senderId;
        uint256 receiverId;
        uint256 activeAgentId;
        PackageStatus status;
        uint256 createdAt;
        uint256 deliveredAt;
        bytes32 deliveryCodeHash;
    }

    struct Transaction {
        uint256 id;
        uint256 packageId;
        uint256 senderId;
        uint256 receiverId;
        uint256 amount;
        string currency;
        TxnStatus status;
        uint256 createdAt;
        uint256 settledAt;
    }

    struct Checkpoint {
        uint256 id;
        uint256 packageId;
        uint256 agentId;
        string location;
        uint256 timestamp;
        PackageStatus status;
    }

    uint256 public userCtr;
    uint256 public packageCtr;
    uint256 public txnCtr;
    uint256 public checkpointCtr;

    mapping(uint256 => User) public users;
    mapping(uint256 => Package) public packages;
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(address => uint256) public userIdByAddress;
    mapping(uint256 => uint256[]) private packageCheckpoints;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyRole(Role _role) {
        require(userIdByAddress[msg.sender] != 0, "Not registered");
        require(users[userIdByAddress[msg.sender]].role == _role, "Wrong role");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerUser(address _address, string memory _name, string memory _phone, Role _role)
        public
        onlyOwner
    {
        require(_address != address(0), "Invalid address");
        require(_role != Role.NONE, "Invalid role");
        require(userIdByAddress[_address] == 0, "Already registered");

        userCtr++;
        users[userCtr] = User(_address, userCtr, _name, _phone, _role, true);
        userIdByAddress[_address] = userCtr;
        emit UserRegistered(userCtr, _role, _address, _name);
    }

    function bookShipment(
        string memory _qrHash,
        string memory _contentHash,
        uint256 _weight,
        string memory _size,
        uint256 _receiverId,
        bytes32 _deliveryCodeHash,
        string memory _currency
    ) public payable onlyRole(Role.SENDER) returns (uint256) {
        require(_receiverId >= 1 && _receiverId <= userCtr, "Invalid receiver");
        require(users[_receiverId].role == Role.RECEIVER, "Receiver must be a RECEIVER");
        require(msg.value > 0, "Escrow amount must be > 0");

        uint256 senderId = userIdByAddress[msg.sender];
        packageCtr++;
        txnCtr++;

        packages[packageCtr] = Package({
            id: packageCtr,
            qrHash: _qrHash,
            contentHash: _contentHash,
            weight: _weight,
            size: _size,
            senderId: senderId,
            receiverId: _receiverId,
            activeAgentId: 0,
            status: PackageStatus.Registered,
            createdAt: block.timestamp,
            deliveredAt: 0,
            deliveryCodeHash: _deliveryCodeHash
        });

        transactions[txnCtr] = Transaction({
            id: txnCtr,
            packageId: packageCtr,
            senderId: senderId,
            receiverId: _receiverId,
            amount: msg.value,
            currency: _currency,
            status: TxnStatus.InEscrow,
            createdAt: block.timestamp,
            settledAt: 0
        });

        emit PackageBooked(packageCtr, _qrHash, senderId, _receiverId, msg.value, _currency);
        return packageCtr;
    }

    function logCheckpoint(uint256 _packageId, string memory _location, PackageStatus _status)
        public
        onlyRole(Role.AGENT)
    {
        require(_packageId >= 1 && _packageId <= packageCtr, "Invalid package");
        Package storage p = packages[_packageId];
        require(p.status != PackageStatus.Delivered, "Already delivered");
        require(p.status != PackageStatus.Cancelled, "Cancelled");
        require(_status > p.status, "Invalid transition");

        uint256 agentId = userIdByAddress[msg.sender];
        checkpointCtr++;
        checkpoints[checkpointCtr] = Checkpoint({
            id: checkpointCtr,
            packageId: _packageId,
            agentId: agentId,
            location: _location,
            timestamp: block.timestamp,
            status: _status
        });
        packageCheckpoints[_packageId].push(checkpointCtr);

        p.activeAgentId = agentId;
        p.status = _status;
        emit CheckpointLogged(checkpointCtr, _packageId, _location, _status);
    }

    function confirmDelivery(uint256 _packageId, string memory _deliveryCode)
        public
        onlyRole(Role.RECEIVER)
    {
        require(_packageId >= 1 && _packageId <= packageCtr, "Invalid package");
        uint256 receiverId = userIdByAddress[msg.sender];
        require(packages[_packageId].receiverId == receiverId, "Not the recipient");

        Package storage p = packages[_packageId];
        require(p.status == PackageStatus.OutForDelivery, "Not out for delivery");
        require(
            keccak256(abi.encodePacked(_deliveryCode)) == p.deliveryCodeHash,
            "Invalid delivery code"
        );

        p.status = PackageStatus.Delivered;
        p.deliveredAt = block.timestamp;
        emit DeliveryConfirmed(_packageId, receiverId);

        Transaction storage txn = transactions[_packageId];
        require(txn.status == TxnStatus.InEscrow, "Not in escrow");
        txn.status = TxnStatus.Paid;
        txn.settledAt = block.timestamp;

        (bool ok, ) = payable(users[p.senderId].addr).call{value: txn.amount}("");
        require(ok, "Release failed");
        emit EscrowReleased(txn.id, _packageId, users[p.senderId].addr, txn.amount);
    }

    function cancelShipment(uint256 _packageId) public onlyRole(Role.SENDER) {
        require(_packageId >= 1 && _packageId <= packageCtr, "Invalid package");
        Package storage p = packages[_packageId];
        require(p.senderId == userIdByAddress[msg.sender], "Not the sender");
        require(p.status == PackageStatus.Registered, "Only before pickup");

        Transaction storage txn = transactions[_packageId];
        require(txn.status == TxnStatus.InEscrow, "Not in escrow");

        p.status = PackageStatus.Cancelled;
        txn.status = TxnStatus.Refunded;
        txn.settledAt = block.timestamp;

        (bool ok, ) = payable(msg.sender).call{value: txn.amount}("");
        require(ok, "Refund failed");
    }

    function getPackage(uint256 _packageId)
        public
        view
        returns (
            string memory qrHash,
            string memory contentHash,
            uint256 weight,
            string memory size,
            uint256 senderId,
            uint256 receiverId,
            uint256 activeAgentId,
            PackageStatus status,
            uint256 createdAt,
            uint256 deliveredAt
        )
    {
        require(_packageId >= 1 && _packageId <= packageCtr, "Invalid package");
        Package storage p = packages[_packageId];
        return (
            p.qrHash,
            p.contentHash,
            p.weight,
            p.size,
            p.senderId,
            p.receiverId,
            p.activeAgentId,
            p.status,
            p.createdAt,
            p.deliveredAt
        );
    }

    function getTransaction(uint256 _txnId)
        public
        view
        returns (
            uint256 packageId,
            uint256 senderId,
            uint256 receiverId,
            uint256 amount,
            string memory currency,
            TxnStatus status,
            uint256 createdAt,
            uint256 settledAt
        )
    {
        require(_txnId >= 1 && _txnId <= txnCtr, "Invalid txn");
        Transaction storage t = transactions[_txnId];
        return (
            t.packageId,
            t.senderId,
            t.receiverId,
            t.amount,
            t.currency,
            t.status,
            t.createdAt,
            t.settledAt
        );
    }

    function getCheckpoints(uint256 _packageId) public view returns (Checkpoint[] memory) {
        require(_packageId >= 1 && _packageId <= packageCtr, "Invalid package");
        uint256 count = packageCheckpoints[_packageId].length;
        Checkpoint[] memory result = new Checkpoint[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = checkpoints[packageCheckpoints[_packageId][i]];
        }
        return result;
    }
}