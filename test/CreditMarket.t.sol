// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";
import {CreditMarket} from "../contracts/CreditMarket.sol";

interface VmCreditMarketTest {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address caller) external;
    function startPrank(address caller) external;
    function stopPrank() external;
    function warp(uint256 timestamp) external;
}

contract CreditMarketTest {
    VmCreditMarketTest private constant vm = VmCreditMarketTest(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant SIGNER_KEY = 0xA11CE;
    uint256 private constant BORROWER_KEY = 0xB0B;
    uint256 private constant GUARANTOR_A_KEY = 0xA;
    uint256 private constant GUARANTOR_B_KEY = 0xB;
    uint256 private constant LENDER_KEY = 0x1EAD;
    uint256 private constant UNIT = 1e6;

    MockUSDC private token;
    CreditMarket private market;
    address private signer;
    address private borrower;
    address private guarantorA;
    address private guarantorB;
    address private lender;

    function setUp() public {
        signer = vm.addr(SIGNER_KEY);
        borrower = vm.addr(BORROWER_KEY);
        guarantorA = vm.addr(GUARANTOR_A_KEY);
        guarantorB = vm.addr(GUARANTOR_B_KEY);
        lender = vm.addr(LENDER_KEY);
        token = new MockUSDC();
        market = new CreditMarket(IERC20(address(token)), signer);

        token.mint(borrower, 10 * UNIT);
        token.mint(guarantorA, 100 * UNIT);
        token.mint(guarantorB, 100 * UNIT);
        token.mint(lender, 100 * UNIT);
    }

    function testRepaymentDistributesPrincipalAndInterest() public {
        uint256 loanId = _createRequest();
        _guarantee(loanId, guarantorA, 25 * UNIT);
        _guarantee(loanId, guarantorB, 25 * UNIT);
        _fund(loanId);

        require(token.balanceOf(borrower) == 110 * UNIT, "Borrower received principal");
        token.mint(borrower, 100 * UNIT);
        vm.startPrank(borrower);
        token.approve(address(market), 110 * UNIT);
        market.repayLoan(loanId);
        vm.stopPrank();

        require(token.balanceOf(lender) == 106 * UNIT, "Lender gets principal and 60 percent interest");
        require(token.balanceOf(guarantorA) == 102 * UNIT, "First guarantor gets collateral and interest");
        require(token.balanceOf(guarantorB) == 102 * UNIT, "Second guarantor gets collateral and interest");
        require(market.repaidCount(borrower) == 1, "Repayment is recorded");
        (address borrower_, address lender_, uint256 principal, uint64 durationSeconds, uint256 guaranteeTotal, uint256 requiredGuarantee, uint64 requestDeadline, uint64 dueAt, uint16 interestBps, uint16 guaranteeBps, uint16 guarantorShare, uint8 status, bytes32 historyHash) = market.getLoanSummary(loanId);
        (uint8 score, uint32 walletAgeDays, uint32 transactionCount, uint16 activeMonths, uint8 supportedAssetCount) = market.getEligibilitySummary(loanId);
        require(status == uint8(CreditMarket.Status.Repaid), "Loan is settled");
        require(principal == 100 * UNIT && durationSeconds == 30 days, "Loan terms are recorded");
        require(borrower_ == borrower && lender_ == lender, "Parties are recorded");
        require(guaranteeTotal == 50 * UNIT && requiredGuarantee == 50 * UNIT, "Guarantee totals are recorded");
        require(interestBps == 1_000 && guaranteeBps == 5_000 && guarantorShare == 4_000, "Interest terms are recorded");
        require(score == 75 && walletAgeDays == 540 && transactionCount == 44 && activeMonths == 12 && supportedAssetCount == 2, "Signed history summary is recorded");
        require(requestDeadline > block.timestamp && dueAt > requestDeadline && historyHash != bytes32(0), "Loan metadata is recorded");
        uint256 lenderBalance = token.balanceOf(lender);
        vm.prank(borrower);
        bool settledTwice;
        try market.repayLoan(loanId) {
            settledTwice = true;
        } catch {}
        require(!settledTwice && token.balanceOf(lender) == lenderBalance, "Settlement cannot be repeated");
    }

    function testDefaultPaysLockedCollateralAndRecordsLenderLoss() public {
        uint256 loanId = _createRequest();
        _guarantee(loanId, guarantorA, 25 * UNIT);
        _guarantee(loanId, guarantorB, 25 * UNIT);
        _fund(loanId);
        (,,, uint64 durationSeconds,,, uint64 requestDeadline, uint64 dueAt,,,, uint8 status,) = market.getLoanSummary(loanId);
        (uint8 score,,,,) = market.getEligibilitySummary(loanId);
        require(requestDeadline < dueAt, "Maturity follows funding");
        require(durationSeconds == 30 days && score == 75, "Loan risk summary is recorded");
        require(status == uint8(CreditMarket.Status.Active), "Loan is active before maturity");

        vm.warp(uint256(dueAt) + 1);
        market.settleDefault(loanId);

        require(token.balanceOf(lender) == 50 * UNIT, "Lender recovers collateral");
        require(token.balanceOf(guarantorA) == 75 * UNIT, "Guarantee collateral is applied");
        require(token.balanceOf(guarantorB) == 75 * UNIT, "Guarantee collateral is applied");
        require(market.defaultCount(borrower) == 1, "Default is recorded");
    }

    function testExpiredUnfundedRequestReturnsGuarantees() public {
        uint256 loanId = _createRequest();
        _guarantee(loanId, guarantorA, 25 * UNIT);
        (,,,,,, uint64 requestDeadline,,,,,,) = market.getLoanSummary(loanId);

        vm.warp(uint256(requestDeadline) + 1);
        market.cancelExpiredRequest(loanId);

        require(token.balanceOf(guarantorA) == 100 * UNIT, "Collateral is returned");
        (,,,,,,,,,,, uint8 finalStatus,) = market.getLoanSummary(loanId);
        require(finalStatus == uint8(CreditMarket.Status.Cancelled), "Request is closed");
    }

    function testFundingRequiresCompleteGuaranteeTarget() public {
        uint256 loanId = _createRequest();
        _guarantee(loanId, guarantorA, 20 * UNIT);
        vm.prank(lender);
        bool funded;
        try market.fundLoan(loanId) {
            funded = true;
        } catch {}
        require(!funded, "Funding requires the full guarantee");
        require(token.balanceOf(lender) == 100 * UNIT, "Lender funds stay untouched");
        require(token.balanceOf(borrower) == 10 * UNIT, "Borrower does not receive funds early");
    }

    function testEligibilitySignatureCannotBeReused() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes32 historyHash = keccak256("wallet history");
        bytes memory signature = _signEligibility(borrower, 5_000 * UNIT, 75, 0, expiry, historyHash, 540, 44, 12, 2);
        uint64 deadline = uint64(block.timestamp + 7 days);
        CreditMarket.Eligibility memory eligibility = CreditMarket.Eligibility({
            score: 75,
            maxLoanAmount: 5_000 * UNIT,
            expiry: expiry,
            historyHash: historyHash,
            walletAgeDays: 540,
            transactionCount: 44,
            activeMonths: 12,
            supportedAssetCount: 2
        });

        vm.prank(borrower);
        market.requestLoan(100 * UNIT, 30 days, 1_000, 5_000, 4_000, deadline, eligibility, signature);

        vm.prank(borrower);
        bool reused;
        try market.requestLoan(100 * UNIT, 30 days, 1_000, 5_000, 4_000, deadline, eligibility, signature) {
            reused = true;
        } catch {}
        require(!reused, "A signature must not be reusable");
        require(market.eligibilityNonce(borrower) == 1, "Nonce advances once");
    }

    function _createRequest() private returns (uint256 loanId) {
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes32 historyHash = keccak256("wallet history");
        bytes memory signature = _signEligibility(
            borrower,
            5_000 * UNIT,
            75,
            market.eligibilityNonce(borrower),
            expiry,
            historyHash,
            540,
            44,
            12,
            2
        );
        CreditMarket.Eligibility memory eligibility = CreditMarket.Eligibility({
            score: 75,
            maxLoanAmount: 5_000 * UNIT,
            expiry: expiry,
            historyHash: historyHash,
            walletAgeDays: 540,
            transactionCount: 44,
            activeMonths: 12,
            supportedAssetCount: 2
        });
        vm.prank(borrower);
        loanId = market.requestLoan(
            100 * UNIT,
            30 days,
            1_000,
            5_000,
            4_000,
            uint64(block.timestamp + 7 days),
            eligibility,
            signature
        );
    }

    function _guarantee(uint256 loanId, address guarantor, uint256 amount) private {
        vm.startPrank(guarantor);
        token.approve(address(market), amount);
        market.commitGuarantee(loanId, amount);
        vm.stopPrank();
    }

    function _fund(uint256 loanId) private {
        vm.startPrank(lender);
        token.approve(address(market), 100 * UNIT);
        market.fundLoan(loanId);
        vm.stopPrank();
    }

    function _signEligibility(
        address account,
        uint256 maxLoanAmount,
        uint256 score,
        uint64 nonce,
        uint64 expiry,
        bytes32 historyHash,
        uint32 walletAgeDays,
        uint32 transactionCount,
        uint16 activeMonths,
        uint8 supportedAssetCount
    ) private returns (bytes memory) {
        bytes32 payload = keccak256(
            abi.encode(address(market), block.chainid, account, maxLoanAmount, score, nonce, expiry, historyHash, walletAgeDays, transactionCount, activeMonths, supportedAssetCount)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payload));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        return abi.encodePacked(r, s, v);
    }
}
