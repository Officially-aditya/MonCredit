"use client";

import { useState } from "react";
import { Check, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { formatUnits, parseUnits, type Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { LoanRecord } from "@/lib/market";
import { creditMarketAbi, creditMarketAddress, mockUsdcAbi, mockUsdcAddress } from "@/lib/market";
import { explorerBaseUrl } from "@/lib/chain";

type Action = "guarantee" | "fund" | "repay" | "default" | "cancel";

export function LoanTransaction({
  action,
  loan,
  onSuccess,
  compact = false,
}: {
  action: Action;
  loan: LoanRecord;
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState(
    formatUnits(
      loan.requiredGuarantee > loan.guaranteeTotal ? loan.requiredGuarantee - loan.guaranteeTotal : 0n,
      6,
    ),
  );
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [hash, setHash] = useState<Hex>();

  const title = {
    guarantee: "Commit guarantee",
    fund: "Fund loan",
    repay: "Repay loan",
    default: "Settle default",
    cancel: "Return guarantee",
  }[action];
  const principal = Number(formatUnits(loan.principal, 6));
  const repayment = loan.principal + (loan.principal * BigInt(loan.interestBps)) / 10_000n;

  async function submit() {
    setError("");
    setHash(undefined);
    if (!address || !client || !creditMarketAddress) {
      setError("Connect your wallet and configure the deployed market address.");
      return;
    }
    if ((action === "guarantee" || action === "fund" || action === "repay") && !mockUsdcAddress) {
      setError("Mock USDC contract address is not configured.");
      return;
    }
    setBusy(true);
    try {
      let transactionAmount = 0n;
      if (action === "guarantee") transactionAmount = parseUnits(amount || "0", 6);
      if (action === "fund") transactionAmount = loan.principal;
      if (action === "repay") transactionAmount = repayment;

      if (transactionAmount > 0n && mockUsdcAddress) {
        const allowance = await client.readContract({
          address: mockUsdcAddress,
          abi: mockUsdcAbi,
          functionName: "allowance",
          args: [address, creditMarketAddress],
        });
        if (allowance < transactionAmount) {
          setStep("Approve test USDC");
          const approval = await writeContractAsync({
            address: mockUsdcAddress,
            abi: mockUsdcAbi,
            functionName: "approve",
            args: [creditMarketAddress, transactionAmount],
          });
          await client.waitForTransactionReceipt({ hash: approval });
        }
      }

      setStep(title);
      let transaction: Hex;
      if (action === "guarantee") {
        transaction = await writeContractAsync({
          address: creditMarketAddress,
          abi: creditMarketAbi,
          functionName: "commitGuarantee",
          args: [BigInt(loan.id), transactionAmount],
        });
      } else if (action === "fund") {
        transaction = await writeContractAsync({
          address: creditMarketAddress,
          abi: creditMarketAbi,
          functionName: "fundLoan",
          args: [BigInt(loan.id)],
        });
      } else if (action === "repay") {
        transaction = await writeContractAsync({
          address: creditMarketAddress,
          abi: creditMarketAbi,
          functionName: "repayLoan",
          args: [BigInt(loan.id)],
        });
      } else if (action === "default") {
        transaction = await writeContractAsync({
          address: creditMarketAddress,
          abi: creditMarketAbi,
          functionName: "settleDefault",
          args: [BigInt(loan.id)],
        });
      } else {
        transaction = await writeContractAsync({
          address: creditMarketAddress,
          abi: creditMarketAbi,
          functionName: "cancelExpiredRequest",
          args: [BigInt(loan.id)],
        });
      }
      setHash(transaction);
      setStep("Waiting for Monad confirmation");
      await client.waitForTransactionReceipt({ hash: transaction });
      setStep("Transaction confirmed");
      onSuccess?.();
    } catch (cause) {
      setError(
        cause instanceof Error && "shortMessage" in cause
          ? String(cause.shortMessage)
          : cause instanceof Error
            ? cause.message
            : "Transaction failed.",
      );
      setStep("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "transaction-control compact" : "transaction-control"}>
      {action === "guarantee" && (
        <label className="transaction-amount-label">Amount to guarantee
          <span className="amount-input-wrap"><span>$</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /><span>mUSDC</span></span>
        </label>
      )}
      {action === "fund" && <p className="transaction-summary">Fund <strong>{"$"}{principal.toLocaleString()} mUSDC</strong>. The borrower receives funds after your transaction confirms.</p>}
      {action === "repay" && <p className="transaction-summary">Total due <strong>{"$"}{new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(formatUnits(repayment, 6)))} mUSDC</strong> including {(loan.interestBps / 100).toFixed(1)}% interest.</p>}
      {action === "default" && <p className="transaction-summary">Anyone can settle after the due date. The lender receives the locked guarantee pool.</p>}
      {action === "cancel" && <p className="transaction-summary">Anyone can close an expired unfunded request; all guarantee commitments are returned.</p>}
      <button className={action === "default" ? "button button-danger button-small" : "button button-primary button-small"} onClick={submit} disabled={busy || !address || (action === "guarantee" && Number(amount) <= 0)}>
        {busy ? <LoaderCircle className="spin" size={15} /> : action === "guarantee" ? <ShieldCheck size={15} /> : <Check size={15} />}
        {busy ? step : title}
      </button>
      {step && !busy && <p className="action-success">{step}</p>}
      {error && <p className="action-error">{error}</p>}
      {hash && <a className="tx-link" href={explorerBaseUrl + "/tx/" + hash} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12} /></a>}
    </div>
  );
}
