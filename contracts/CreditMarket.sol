// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title CreditMarket
/// @notice Native MON lending backed by borrower-supplied Ethereum history attestations
///         and collateral commitments from multiple guarantors.
contract CreditMarket is Ownable, ReentrancyGuard {
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_GUARANTORS = 16;
    uint64 public constant MIN_DURATION = 1 days;
    uint64 public constant MAX_DURATION = 365 days;
    uint16 public constant MAX_INTEREST_BPS = 3_000;

    enum Status {
        Open,
        Active,
        Repaid,
        Defaulted,
        Cancelled
    }

    struct Loan {
        address borrower;
        address lender;
        uint128 principal;
        uint128 guaranteeTotal;
        uint64 durationSeconds;
        uint64 createdAt;
        uint64 requestDeadline;
        uint64 dueAt;
        uint16 interestBps;
        uint16 guaranteeBps;
        uint16 guarantorInterestBps;
        uint8 eligibilityScore;
        uint32 walletAgeDays;
        uint32 transactionCount;
        uint16 activeMonths;
        uint8 supportedAssetCount;
        Status status;
        bytes32 historyHash;
    }

    struct Eligibility {
        uint256 score;
        uint256 maxLoanAmount;
        uint64 expiry;
        bytes32 historyHash;
        uint32 walletAgeDays;
        uint32 transactionCount;
        uint16 activeMonths;
        uint8 supportedAssetCount;
    }

    address public eligibilitySigner;
    uint256 public nextLoanId = 1;
    mapping(uint256 loanId => Loan) private loans;
    mapping(uint256 loanId => address[]) private guarantors;
    mapping(uint256 loanId => mapping(address guarantor => uint256 amount)) public guaranteeOf;
    mapping(address borrower => uint64 nonce) public eligibilityNonce;
    mapping(address borrower => uint256 count) public repaidCount;
    mapping(address borrower => uint256 count) public defaultCount;
    mapping(address lender => uint256 count) public fundedCount;
    mapping(address borrower => uint256 amount) public totalBorrowed;
    mapping(address borrower => uint256 amount) public totalRepaid;

    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint64 requestDeadline,
        bytes32 historyHash
    );
    event GuaranteeCommitted(uint256 indexed loanId, address indexed guarantor, uint256 amount);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint64 dueAt);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 interest);
    event LoanDefaulted(uint256 indexed loanId, uint256 collateralRecovered, uint256 lenderLoss);
    event LoanCancelled(uint256 indexed loanId);
    event EligibilitySignerUpdated(address indexed signer);

    constructor(address signer_) Ownable(msg.sender) {
        require(signer_ != address(0), "Invalid signer");
        eligibilitySigner = signer_;
    }

    function setEligibilitySigner(address signer) external onlyOwner {
        require(signer != address(0), "Invalid signer");
        eligibilitySigner = signer;
        emit EligibilitySignerUpdated(signer);
    }

    /// @dev Signature is an EIP-191 personal signature of:
    ///      keccak256(abi.encode(address(this), chainid, borrower, eligibility.maxLoanAmount,
    ///      eligibility.score, nonce, eligibility.expiry, eligibility.historyHash,
    ///      eligibility.walletAgeDays, eligibility.transactionCount, eligibility.activeMonths,
    ///      eligibility.supportedAssetCount)).
    function requestLoan(
        uint256 amount,
        uint64 durationSeconds,
        uint16 interestBps,
        uint16 guaranteeBps,
        uint16 guarantorInterestBps,
        uint64 requestDeadline,
        Eligibility calldata eligibility,
        bytes calldata signature
    ) external nonReentrant returns (uint256 loanId) {
        require(amount > 0 && amount <= type(uint128).max, "Invalid amount");
        require(durationSeconds >= MIN_DURATION && durationSeconds <= MAX_DURATION, "Invalid duration");
        require(interestBps > 0 && interestBps <= MAX_INTEREST_BPS, "Invalid interest");
        require(guaranteeBps > 0 && guaranteeBps <= BPS, "Invalid coverage");
        require(guarantorInterestBps <= BPS, "Invalid split");
        require(requestDeadline > block.timestamp && requestDeadline <= block.timestamp + 14 days, "Invalid deadline");
        require(eligibility.expiry >= block.timestamp, "Eligibility expired");
        require(eligibility.score <= 100 && amount <= eligibility.maxLoanAmount, "Not eligible for amount");

        uint64 nonce = eligibilityNonce[msg.sender];
        bytes32 payload = keccak256(
            abi.encode(
                address(this),
                block.chainid,
                msg.sender,
                eligibility.maxLoanAmount,
                eligibility.score,
                nonce,
                eligibility.expiry,
                eligibility.historyHash,
                eligibility.walletAgeDays,
                eligibility.transactionCount,
                eligibility.activeMonths,
                eligibility.supportedAssetCount
            )
        );
        address recovered = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(payload), signature);
        require(recovered == eligibilitySigner, "Invalid eligibility signature");
        eligibilityNonce[msg.sender] = nonce + 1;

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            lender: address(0),
            principal: uint128(amount),
            guaranteeTotal: 0,
            durationSeconds: durationSeconds,
            createdAt: uint64(block.timestamp),
            requestDeadline: requestDeadline,
            dueAt: 0,
            interestBps: interestBps,
            guaranteeBps: guaranteeBps,
            guarantorInterestBps: guarantorInterestBps,
            eligibilityScore: uint8(eligibility.score),
            walletAgeDays: eligibility.walletAgeDays,
            transactionCount: eligibility.transactionCount,
            activeMonths: eligibility.activeMonths,
            supportedAssetCount: eligibility.supportedAssetCount,
            status: Status.Open,
            historyHash: eligibility.historyHash
        });
        emit LoanRequested(loanId, msg.sender, amount, requestDeadline, eligibility.historyHash);
    }

    function commitGuarantee(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "Unknown loan");
        require(loan.status == Status.Open, "Loan not open");
        require(block.timestamp <= loan.requestDeadline, "Request expired");
        require(msg.sender != loan.borrower, "Borrower cannot guarantee");
        uint256 amount = msg.value;
        require(amount > 0, "Invalid amount");

        uint256 required = minimumGuarantee(loanId);
        require(uint256(loan.guaranteeTotal) + amount <= required, "Guarantee exceeds target");
        if (guaranteeOf[loanId][msg.sender] == 0) {
            require(guarantors[loanId].length < MAX_GUARANTORS, "Too many guarantors");
            guarantors[loanId].push(msg.sender);
        }

        guaranteeOf[loanId][msg.sender] += amount;
        loan.guaranteeTotal += uint128(amount);
        emit GuaranteeCommitted(loanId, msg.sender, amount);
    }

    function fundLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "Unknown loan");
        require(loan.status == Status.Open, "Loan not open");
        require(block.timestamp <= loan.requestDeadline, "Request expired");
        require(loan.guaranteeTotal >= minimumGuarantee(loanId), "Guarantee target not met");
        require(msg.sender != loan.borrower, "Borrower cannot lend");
        require(guaranteeOf[loanId][msg.sender] == 0, "Guarantor cannot lend");
        require(msg.value == loan.principal, "Incorrect MON amount");

        loan.lender = msg.sender;
        loan.dueAt = uint64(block.timestamp) + loan.durationSeconds;
        loan.status = Status.Active;
        _sendNative(loan.borrower, loan.principal);
        totalBorrowed[loan.borrower] += loan.principal;
        fundedCount[msg.sender] += 1;
        emit LoanFunded(loanId, msg.sender, loan.dueAt);
    }

    function repayLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.Active, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower");
        require(block.timestamp <= loan.dueAt, "Loan past due");

        uint256 interest = uint256(loan.principal) * loan.interestBps / BPS;
        require(msg.value == uint256(loan.principal) + interest, "Incorrect MON amount");
        uint256 guarantorInterest = interest * loan.guarantorInterestBps / BPS;
        uint256 lenderInterest = interest - guarantorInterest;

        loan.status = Status.Repaid;
        repaidCount[loan.borrower] += 1;
        totalRepaid[loan.borrower] += uint256(loan.principal) + interest;
        _sendNative(loan.lender, uint256(loan.principal) + lenderInterest);

        address[] storage list = guarantors[loanId];
        uint256 interestRemaining = guarantorInterest;
        for (uint256 i; i < list.length; ++i) {
            address guarantor = list[i];
            uint256 committed = guaranteeOf[loanId][guarantor];
            uint256 share = i == list.length - 1
                ? interestRemaining
                : guarantorInterest * committed / loan.guaranteeTotal;
            interestRemaining -= share;
            _sendNative(guarantor, committed + share);
        }

        emit LoanRepaid(loanId, loan.principal, interest);
    }

    function settleDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.Active, "Loan not active");
        require(block.timestamp > loan.dueAt, "Loan not past due");

        uint256 recovered = loan.guaranteeTotal;
        uint256 loss = uint256(loan.principal) - recovered;
        loan.status = Status.Defaulted;
        defaultCount[loan.borrower] += 1;
        if (recovered > 0) _sendNative(loan.lender, recovered);
        emit LoanDefaulted(loanId, recovered, loss);
    }

    function cancelExpiredRequest(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.Open, "Loan not open");
        require(block.timestamp > loan.requestDeadline, "Request not expired");
        loan.status = Status.Cancelled;
        address[] storage list = guarantors[loanId];
        for (uint256 i; i < list.length; ++i) {
            address guarantor = list[i];
            uint256 amount = guaranteeOf[loanId][guarantor];
            if (amount > 0) _sendNative(guarantor, amount);
        }
        emit LoanCancelled(loanId);
    }

    function _sendNative(address recipient, uint256 amount) private {
        (bool success,) = payable(recipient).call{value: amount}("");
        require(success, "MON transfer failed");
    }

    function minimumGuarantee(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        return uint256(loan.principal) * loan.guaranteeBps / BPS;
    }

    function getLoanSummary(uint256 loanId)
        external
        view
        returns (
            address borrower,
            address lender,
            uint256 principal,
            uint64 durationSeconds,
            uint256 guaranteeTotal,
            uint256 requiredGuarantee,
            uint64 requestDeadline,
            uint64 dueAt,
            uint16 interestBps,
            uint16 guaranteeBps,
            uint16 guarantorInterestBps,
            uint8 status,
            bytes32 historyHash
        )
    {
        Loan storage loan = loans[loanId];
        return (
            loan.borrower,
            loan.lender,
            loan.principal,
            loan.durationSeconds,
            loan.guaranteeTotal,
            minimumGuarantee(loanId),
            loan.requestDeadline,
            loan.dueAt,
            loan.interestBps,
            loan.guaranteeBps,
            loan.guarantorInterestBps,
            uint8(loan.status),
            loan.historyHash
        );
    }

    function getEligibilitySummary(uint256 loanId)
        external
        view
        returns (
            uint8 score,
            uint32 walletAgeDays,
            uint32 transactionCount,
            uint16 activeMonths,
            uint8 supportedAssetCount
        )
    {
        Loan storage loan = loans[loanId];
        return (
            loan.eligibilityScore,
            loan.walletAgeDays,
            loan.transactionCount,
            loan.activeMonths,
            loan.supportedAssetCount
        );
    }

    function getGuarantors(uint256 loanId)
        external
        view
        returns (address[] memory addresses, uint256[] memory amounts)
    {
        address[] storage list = guarantors[loanId];
        addresses = new address[](list.length);
        amounts = new uint256[](list.length);
        for (uint256 i; i < list.length; ++i) {
            addresses[i] = list[i];
            amounts[i] = guaranteeOf[loanId][list[i]];
        }
    }

    function loanCount() external view returns (uint256) {
        return nextLoanId - 1;
    }

    function userCreditRecord(address borrower)
        external
        view
        returns (uint256 repaid, uint256 defaults, uint256 borrowed, uint256 repaidAmount)
    {
        return (
            repaidCount[borrower],
            defaultCount[borrower],
            totalBorrowed[borrower],
            totalRepaid[borrower]
        );
    }
}
