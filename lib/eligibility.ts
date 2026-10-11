export type EligibilityAuthorization = {
  ethereumAddress: string;
  borrowingAddress: string;
  score: number;
  scoreParts: {
    walletAge: number;
    transactionActivity: number;
    activeMonths: number;
    supportedAssetHistory: number;
    repaymentBonus: number;
    defaultPenalty: number;
  };
  maxLoanAmount: string;
  maxLoanUsd: number;
  nonce: string;
  eligibilityExpiry: string;
  historyHash: string;
  signature: string;
  history: {
    walletAgeDays: number;
    transactionCount: number;
    activeMonths: number;
    observedSupportedAssets: string[];
    heldSupportedAssets: string[];
    historicalHoldings: {
      blockNumber: number;
      timestamp: number;
      nativeEth: string;
      tokens: { symbol: string; balance: string; rawBalance: string }[];
    }[];
    firstSeenAt: string | null;
    creditRecord: {
      repaidCount: number;
      defaultCount: number;
      totalBorrowed: string;
      totalRepaid: string;
    };
    methodologyVersion: string;
  };
  warnings: string[];
};

export function readEligibility(address?: string): EligibilityAuthorization | null {
  if (!address || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("moncredit:eligibility:" + address.toLowerCase());
    if (!raw) return null;
    const value = JSON.parse(raw) as EligibilityAuthorization;
    if (value.borrowingAddress.toLowerCase() !== address.toLowerCase()) return null;
    if (Number(value.eligibilityExpiry) < Math.floor(Date.now() / 1_000)) return null;
    return value;
  } catch {
    return null;
  }
}
