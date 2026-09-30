// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HoneyTraceability {
    struct Batch {
        string batchId;
        uint256 farmerId;
        string honeyType;
        uint256 quantityGrams;
        string harvestDate;
        bool exists;
    }

    struct TraceabilityEvent {
        string batchId;
        string eventType;
        string fromEntity;
        string toEntity;
        string location;
        uint256 timestamp;
        string metadata;
    }

    struct LabHash {
        string batchId;
        string reportNumber;
        string dataHash;
    }

    address public immutable owner;

    mapping(string => Batch) private batches;
    mapping(string => TraceabilityEvent[]) private batchEvents;
    mapping(string => mapping(string => LabHash)) private labHashes;
    mapping(string => mapping(string => bool)) private labHashExists;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can write");
        _;
    }

    modifier nonEmpty(string memory value, string memory field) {
        require(bytes(value).length > 0, field);
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createBatch(
        string calldata batchId,
        uint256 farmerId,
        string calldata honeyType,
        uint256 quantityGrams,
        string calldata harvestDate
    )
        external
        onlyOwner
        nonEmpty(batchId, "Batch ID required")
        nonEmpty(honeyType, "Honey type required")
        nonEmpty(harvestDate, "Harvest date required")
    {
        require(!batches[batchId].exists, "Batch already exists");
        require(farmerId > 0, "Farmer ID required");
        require(quantityGrams > 0, "Quantity required");

        batches[batchId] = Batch({
            batchId: batchId,
            farmerId: farmerId,
            honeyType: honeyType,
            quantityGrams: quantityGrams,
            harvestDate: harvestDate,
            exists: true
        });

        emit BatchCreated(
            batchId,
            farmerId,
            honeyType,
            quantityGrams,
            harvestDate
        );
    }

    function addEvent(
        string calldata batchId,
        string calldata eventType,
        string calldata fromEntity,
        string calldata toEntity,
        string calldata location,
        uint256 timestamp,
        string calldata metadata
    )
        external
        onlyOwner
        nonEmpty(batchId, "Batch ID required")
        nonEmpty(eventType, "Event type required")
        nonEmpty(fromEntity, "From entity required")
        nonEmpty(toEntity, "To entity required")
        nonEmpty(location, "Location required")
    {
        require(batches[batchId].exists, "Batch does not exist");
        require(timestamp > 0, "Timestamp required");

        batchEvents[batchId].push(
            TraceabilityEvent({
                batchId: batchId,
                eventType: eventType,
                fromEntity: fromEntity,
                toEntity: toEntity,
                location: location,
                timestamp: timestamp,
                metadata: metadata
            })
        );

        emit TraceabilityEventAdded(
            batchId,
            eventType,
            fromEntity,
            toEntity,
            location,
            timestamp,
            metadata
        );
    }

    function addLabHash(
        string calldata batchId,
        string calldata reportNumber,
        string calldata dataHash
    )
        external
        onlyOwner
        nonEmpty(batchId, "Batch ID required")
        nonEmpty(reportNumber, "Report number required")
        nonEmpty(dataHash, "Data hash required")
    {
        require(batches[batchId].exists, "Batch does not exist");
        require(
            !labHashExists[batchId][reportNumber],
            "Lab hash already exists"
        );

        labHashes[batchId][reportNumber] = LabHash({
            batchId: batchId,
            reportNumber: reportNumber,
            dataHash: dataHash
        });

        labHashExists[batchId][reportNumber] = true;

        emit LabHashAdded(batchId, reportNumber, dataHash);
    }

    function getBatch(
        string calldata batchId
    )
        external
        view
        returns (
            string memory,
            uint256,
            string memory,
            uint256,
            string memory,
            bool
        )
    {
        Batch memory batch = batches[batchId];

        return (
            batch.batchId,
            batch.farmerId,
            batch.honeyType,
            batch.quantityGrams,
            batch.harvestDate,
            batch.exists
        );
    }

    function getEvents(
        string calldata batchId
    ) external view returns (TraceabilityEvent[] memory) {
        return batchEvents[batchId];
    }

    function getLabHash(
        string calldata batchId,
        string calldata reportNumber
    ) external view returns (string memory, string memory, string memory) {
        LabHash memory result = labHashes[batchId][reportNumber];

        return (result.batchId, result.reportNumber, result.dataHash);
    }

    event BatchCreated(
        string batchId,
        uint256 farmerId,
        string honeyType,
        uint256 quantityGrams,
        string harvestDate
    );

    event TraceabilityEventAdded(
        string batchId,
        string eventType,
        string fromEntity,
        string toEntity,
        string location,
        uint256 timestamp,
        string metadata
    );

    event LabHashAdded(
        string batchId,
        string reportNumber,
        string dataHash
    );
}