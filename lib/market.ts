import type { Address, Hex } from "viem";

export const creditMarketAddress = process.env.NEXT_PUBLIC_CREDIT_MARKET_ADDRESS as Address | undefined;
export const mockUsdcAddress = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as Address | undefined;

export const creditMarketAbi = [
  {
    type: "function",
    name: "requestLoan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "durationSeconds", type: "uint64" },
      { name: "interestBps", type: "uint16" },
      { name: "guaranteeBps", type: "uint16" },
      { name: "guarantorInterestBps", type: "uint16" },
      { name: "requestDeadline", type: "uint64" },
      {
        name: "eligibility",
        type: "tuple",
        components: [
          { name: "score", type: "uint256" },
          { name: "maxLoanAmount", type: "uint256" },
          { name: "expiry", type: "uint64" },
          { name: "historyHash", type: "bytes32" },
          { name: "walletAgeDays", type: "uint32" },
          { name: "transactionCount", type: "uint32" },
          { name: "activeMonths", type: "uint16" },
          { name: "supportedAssetCount", type: "uint8" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    type: "function",
    name: "commitGuarantee",
    stateMutability: "nonpayable",
    inputs: [
      { name: "loanId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fundLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "repayLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "settleDefault",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelExpiredRequest",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "minimumGuarantee",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getLoanSummary",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      { name: "borrower", type: "address" },
      { name: "lender", type: "address" },
      { name: "principal", type: "uint256" },
      { name: "durationSeconds", type: "uint64" },
      { name: "guaranteeTotal", type: "uint256" },
      { name: "requiredGuarantee", type: "uint256" },
      { name: "requestDeadline", type: "uint64" },
      { name: "dueAt", type: "uint64" },
      { name: "interestBps", type: "uint16" },
      { name: "guaranteeBps", type: "uint16" },
      { name: "guarantorInterestBps", type: "uint16" },
      { name: "status", type: "uint8" },
      { name: "historyHash", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "getEligibilitySummary",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      { name: "eligibilityScore", type: "uint8" },
      { name: "walletAgeDays", type: "uint32" },
      { name: "transactionCount", type: "uint32" },
      { name: "activeMonths", type: "uint16" },
      { name: "supportedAssetCount", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "getGuarantors",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      { name: "addresses", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "loanCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "userCreditRecord",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [
      { name: "repaid", type: "uint256" },
      { name: "defaults", type: "uint256" },
      { name: "borrowed", type: "uint256" },
      { name: "repaidAmount", type: "uint256" },
    ],
  },
] as const;

export const mockUsdcAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "claimFaucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export type LoanStatus = "Open" | "Active" | "Repaid" | "Defaulted" | "Cancelled";

export type LoanRecord = {
  id: string;
  borrower: Address;
  lender: Address;
  principal: bigint;
  durationSeconds: number;
  guaranteeTotal: bigint;
  requiredGuarantee: bigint;
  requestDeadline: number;
  dueAt: number;
  interestBps: number;
  guaranteeBps: number;
  guarantorInterestBps: number;
  eligibilityScore: number;
  walletAgeDays: number;
  transactionCount: number;
  activeMonths: number;
  supportedAssetCount: number;
  status: LoanStatus;
  historyHash: Hex;
  guarantees: { address: Address; amount: bigint }[];
};

export const loanStatusNames: LoanStatus[] = ["Open", "Active", "Repaid", "Defaulted", "Cancelled"];
