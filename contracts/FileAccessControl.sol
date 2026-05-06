// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FileAccessControl
 * @notice Manages file ownership and viewer access for IPFS-hosted files.
 *         The uploader (owner) of a file can grant or revoke view access
 *         to any Ethereum address.
 */
contract FileAccessControl {
    uint256 public constant MAX_CID_LENGTH = 128;
    uint256 public constant MAX_FILENAME_LENGTH = 256;

    // ───────── Data Structures ─────────

    struct FileInfo {
        string  cid;        // IPFS content identifier
        string  fileName;   // Original file name
        address owner;      // Address that uploaded the file
        uint256 uploadedAt; // Block timestamp of upload
    }

    // ───────── State ─────────

    /// @dev fileId ⇒ FileInfo
    mapping(uint256 => FileInfo) public files;

    /// @dev fileId ⇒ viewer address ⇒ has access?
    mapping(uint256 => mapping(address => bool)) public accessList;

    /// @dev owner address ⇒ array of fileIds they've uploaded
    mapping(address => uint256[]) public ownerFiles;

    /// @dev Auto-incrementing file counter (also used as fileId)
    uint256 public fileCount;

    // ───────── Events ─────────

    event FileUploaded(
        uint256 indexed fileId,
        string  cid,
        string  fileName,
        address indexed owner,
        uint256 uploadedAt
    );

    event AccessGranted(uint256 indexed fileId, address indexed viewer, address indexed owner);
    event AccessRevoked(uint256 indexed fileId, address indexed viewer, address indexed owner);

    // ───────── Modifiers ─────────

    modifier onlyFileOwner(uint256 _fileId) {
        require(files[_fileId].owner == msg.sender, "Not the file owner");
        _;
    }

    modifier fileExists(uint256 _fileId) {
        require(files[_fileId].owner != address(0), "File does not exist");
        _;
    }

    // ───────── Core Functions ─────────

    /**
     * @notice Register a newly uploaded file on-chain.
     * @param _cid      IPFS CID of the uploaded file
     * @param _fileName Original file name
     * @return fileId   The unique identifier assigned to this file
     */
    function registerFile(string calldata _cid, string calldata _fileName)
        external
        returns (uint256 fileId)
    {
        require(bytes(_cid).length > 0, "CID cannot be empty");
        require(bytes(_cid).length <= MAX_CID_LENGTH, "CID too long");
        require(bytes(_fileName).length > 0, "File name cannot be empty");
        require(bytes(_fileName).length <= MAX_FILENAME_LENGTH, "File name too long");

        fileId = fileCount;
        fileCount++;

        files[fileId] = FileInfo({
            cid: _cid,
            fileName: _fileName,
            owner: msg.sender,
            uploadedAt: block.timestamp
        });

        // Owner always has access to their own files
        accessList[fileId][msg.sender] = true;

        ownerFiles[msg.sender].push(fileId);

        emit FileUploaded(fileId, _cid, _fileName, msg.sender, block.timestamp);
    }

    /**
     * @notice Grant view access to a single address.
     */
    function grantAccess(uint256 _fileId, address _viewer)
        external
        fileExists(_fileId)
        onlyFileOwner(_fileId)
    {
        require(_viewer != address(0), "Invalid address");
        require(!accessList[_fileId][_viewer], "Already has access");

        accessList[_fileId][_viewer] = true;
        emit AccessGranted(_fileId, _viewer, msg.sender);
    }

    /**
     * @notice Revoke view access from a single address.
     */
    function revokeAccess(uint256 _fileId, address _viewer)
        external
        fileExists(_fileId)
        onlyFileOwner(_fileId)
    {
        require(_viewer != msg.sender, "Cannot revoke own access");
        require(accessList[_fileId][_viewer], "Does not have access");

        accessList[_fileId][_viewer] = false;
        emit AccessRevoked(_fileId, _viewer, msg.sender);
    }

    /**
     * @notice Grant access to multiple addresses in one transaction.
     */
    function grantAccessBatch(uint256 _fileId, address[] calldata _viewers)
        external
        fileExists(_fileId)
        onlyFileOwner(_fileId)
    {
        for (uint256 i = 0; i < _viewers.length; i++) {
            if (_viewers[i] != address(0) && !accessList[_fileId][_viewers[i]]) {
                accessList[_fileId][_viewers[i]] = true;
                emit AccessGranted(_fileId, _viewers[i], msg.sender);
            }
        }
    }

    /**
     * @notice Revoke access from multiple addresses in one transaction.
     */
    function revokeAccessBatch(uint256 _fileId, address[] calldata _viewers)
        external
        fileExists(_fileId)
        onlyFileOwner(_fileId)
    {
        for (uint256 i = 0; i < _viewers.length; i++) {
            if (_viewers[i] != msg.sender && accessList[_fileId][_viewers[i]]) {
                accessList[_fileId][_viewers[i]] = false;
                emit AccessRevoked(_fileId, _viewers[i], msg.sender);
            }
        }
    }

    // ───────── View Functions ─────────

    /**
     * @notice Check whether an address can view a file.
     */
    function hasAccess(uint256 _fileId, address _viewer)
        external
        view
        fileExists(_fileId)
        returns (bool)
    {
        return accessList[_fileId][_viewer];
    }

    /**
     * @notice Return file info (only if caller has access).
     */
    function getFile(uint256 _fileId)
        external
        view
        fileExists(_fileId)
        returns (string memory cid, string memory fileName, address owner, uint256 uploadedAt)
    {
        require(accessList[_fileId][msg.sender], "No access to this file");

        FileInfo storage f = files[_fileId];
        return (f.cid, f.fileName, f.owner, f.uploadedAt);
    }

    /**
     * @notice Return all file IDs uploaded by a given owner.
     */
    function getOwnerFiles(address _owner) external view returns (uint256[] memory) {
        return ownerFiles[_owner];
    }

    /**
     * @notice Return a page of file IDs uploaded by an owner.
     */
    function getOwnerFilesPaginated(address _owner, uint256 _offset, uint256 _limit)
        external
        view
        returns (uint256[] memory page, uint256 total)
    {
        total = ownerFiles[_owner].length;
        if (_offset >= total) {
            return (new uint256[](0), total);
        }

        uint256 remaining = total - _offset;
        uint256 count = _limit < remaining ? _limit : remaining;
        page = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            page[i] = ownerFiles[_owner][_offset + i];
        }
    }

    /**
     * @notice Total number of registered files.
     */
    function totalFiles() external view returns (uint256) {
        return fileCount;
    }
}
