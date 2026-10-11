"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronDown, ExternalLink, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { formatUnits, parseUnits, type Hex } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { LoanCard } from "@/components/loan-card";
import { LoanTransaction } from "@/components/loan-transaction";
import { useMarketLoans } from "@/components/market-hooks";
import { creditMarketAbi, creditMarketAddress } from "@/lib/market";
import { explorerBaseUrl } from "@/lib/chain";
import { readEligibility, type EligibilityAuthorization } from "@/lib/eligibility";

export default function BorrowPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { loans, loading, refresh } = useMarketLoans();
  const { writeContractAsync, error } = useWriteContract();
  const [eligibility, setEligibility] = useState<EligibilityAuthorization | null>(null);
  const [amount, setAmount] = useState("100");
  const [durationDays, setDurationDays] = useState("30");
  const [interestPercent, setInterestPercent] = useState("10");
  const [guaranteePercent, setGuaranteePercent] = useState("50");
  const [guarantorSharePercent, setGuarantorSharePercent] = useState("40");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [hash, setHash] = useState<Hex>();
  const [createdLoanId, setCreatedLoanId] = useState("");
  const [formError, setFormError] = useState("");
  const receipt = useWaitForTransactionReceipt({ hash });
  const terms = {
    interestBps: Math.round(Number(interestPercent) * 100),
    guaranteeBps: Math.round(Number(guaranteePercent) * 100),
    guarantorInterestBps: Math.round(Number(guarantorSharePercent) * 100),
  };

  useEffect(() => {
    setEligibility(readEligibility(address));
  }, [address]);

  const myLoans = useMemo(
    () => address ? loans.filter((loan) => loan.borrower.toLowerCase() === address.toLowerCase()) : [],
    [address, loans],
  );

  async function requestLoan() {
    setFormError("");
    setCreatedLoanId("");
    if (!address || !eligibility) {
      setFormError("Verify your Ethereum history for this Monad wallet before requesting a loan.");
      return;
    }
    if (!creditMarketAddress || !client) {
      setFormError("Deploy the market contract and configure its address to enable lending.");
      return;
    }
    let principal: bigint;
    try {
      principal = parseUnits(amount, 6);
    } catch {
      setFormError("Enter a valid loan amount.");
      return;
    }
    if (principal <= 0n || principal > BigInt(eligibility.maxLoanAmount)) {
      setFormError("The request must be greater than zero and within your verified borrowing limit.");
      return;
    }
    if (terms.interestBps < 1 || terms.interestBps > 3_000) {
      setFormError("Choose a flat interest rate between 0.01% and 30%.");
      return;
    }
    if (terms.guaranteeBps < 1 || terms.guaranteeBps > 10_000) {
      setFormError("Guarantee coverage must be between 1% and 100%.");
      return;
    }
    if (terms.guarantorInterestBps < 0 || terms.guarantorInterestBps > 10_000) {
      setFormError("The guarantor share must be between 0% and 100% of the interest.");
      return;
    }
    if (Number(eligibility.eligibilityExpiry) <= Math.floor(Date.now() / 1_000)) {
      setFormError("Your eligibility authorization expired. Verify your history again.");
      return;
    }

    setBusy(true);
    try {
      setStep("Submitting loan request");
      const tx = await writeContractAsync({
        address: creditMarketAddress,
        abi: creditMarketAbi,
        functionName: "requestLoan",
        args: [
          principal,
          BigInt(Number(durationDays) * 86_400),
          terms.interestBps,
          terms.guaranteeBps,
          terms.guarantorInterestBps,
          BigInt(Math.floor(Date.now() / 1_000) + 7 * 86_400),
          {
            score: BigInt(eligibility.score),
            maxLoanAmount: BigInt(eligibility.maxLoanAmount),
            expiry: BigInt(eligibility.eligibilityExpiry),
            historyHash: eligibility.historyHash as Hex,
            walletAgeDays: eligibility.history.walletAgeDays,
            transactionCount: eligibility.history.transactionCount,
            activeMonths: eligibility.history.activeMonths,
            supportedAssetCount: eligibility.history.observedSupportedAssets.length,
          },
          eligibility.signature as Hex,
        ],
      });
      setHash(tx);
      setStep("Waiting for Monad confirmation");
      await client.waitForTransactionReceipt({ hash: tx });
      setStep("Request created");
      const count = await client.readContract({
        address: creditMarketAddress,
        abi: creditMarketAbi,
        functionName: "loanCount",
      });
      setCreatedLoanId(count.toString());
      void refresh();
    } catch (cause) {
      setFormError(cause instanceof Error && "shortMessage" in cause ? String(cause.shortMessage) : cause instanceof Error ? cause.message : "Loan request failed.");
      setStep("");
    } finally {
      setBusy(false);
    }
  }

  const principalPreview = parseAmountOrZero(amount);
  const interestPreview = principalPreview * BigInt(Math.max(0, Number.isFinite(terms.interestBps) ? terms.interestBps : 0)) / 10_000n;
  const repaymentPreview = principalPreview + interestPreview;
  const guaranteePreview = principalPreview * BigInt(Math.max(0, Number.isFinite(terms.guaranteeBps) ? terms.guaranteeBps : 0)) / 10_000n;
  const guarantorRewardPreview = interestPreview * BigInt(Math.max(0, Number.isFinite(terms.guarantorInterestBps) ? terms.guarantorInterestBps : 0)) / 10_000n;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div><span className="eyebrow">BORROW</span><h1>Make room to move.</h1><p>Request a loan with clear terms. Your verified Ethereum history signs the eligibility authorization.</p></div>
        <div className="heading-note"><ShieldCheck size={16} /><span>Default terms<br /><strong>10% interest · 50% guarantee</strong></span></div>
      </div>

      <div className="borrow-layout">
        <section className="content-card borrow-form-card">
          <div className="card-heading"><div><span className="eyebrow">NEW REQUEST</span><h2>Set your loan terms</h2></div><span className="card-icon"><Sparkles size={17} /></span></div>
          {!eligibility && <div className="notice notice-neutral"><BadgeCheck size={16} /><span>Start by verifying your wallet history. <Link href="/app/verify">Verify now <ArrowRight size={13} /></Link></span></div>}
          {eligibility && eligibility.maxLoanUsd === 0 && <div className="notice notice-neutral"><BadgeCheck size={16} /><span>Your observable history does not meet the initial borrowing threshold. The assessment is transparent; there is no guaranteed credit limit.</span></div>}
          <label className="form-label" htmlFor="loan-amount">Loan amount</label>
          <div className="amount-input-wrap amount-input-large"><span>$</span><input id="loan-amount" type="number" min="1" max={eligibility?.maxLoanUsd || undefined} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /><span>mUSDC</span></div>
          <div className="form-help-row"><span>Up to your estimated limit</span><strong>{eligibility ? "$" + eligibility.maxLoanUsd.toLocaleString() : "Verify history first"}</strong></div>

          <label className="form-label" htmlFor="loan-duration">Repayment term</label>
          <div className="select-wrap"><select id="loan-duration" value={durationDays} onChange={(event) => setDurationDays(event.target.value)}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="180">180 days</option></select><ChevronDown size={15} /></div>

          <div className="terms-config-grid">
            <label className="config-field" htmlFor="interest-percent">Flat interest
              <span className="config-input-wrap"><input id="interest-percent" type="number" min="0.01" max="30" step="0.1" value={interestPercent} onChange={(event) => setInterestPercent(event.target.value)} /><span>%</span></span>
            </label>
            <label className="config-field" htmlFor="guarantee-percent">Coverage target
              <span className="config-input-wrap"><input id="guarantee-percent" type="number" min="1" max="100" step="1" value={guaranteePercent} onChange={(event) => setGuaranteePercent(event.target.value)} /><span>%</span></span>
            </label>
            <label className="config-field" htmlFor="guarantor-share-percent">Guarantor share
              <span className="config-input-wrap"><input id="guarantor-share-percent" type="number" min="0" max="100" step="1" value={guarantorSharePercent} onChange={(event) => setGuarantorSharePercent(event.target.value)} /><span>%</span></span>
            </label>
          </div>

          <div className="terms-box">
            <div className="terms-heading"><strong>Repayment preview</strong><span className="terms-tag">FLAT RATE</span></div>
            <div className="terms-line"><span>Loan principal</span><strong>{formatAmount(principalPreview)} mUSDC</strong></div>
            <div className="terms-line"><span>Interest ({interestPercent || "0"}%)</span><strong>{formatAmount(interestPreview)} mUSDC</strong></div>
            <div className="terms-line total"><span>Total repayment</span><strong>{formatAmount(repaymentPreview)} mUSDC</strong></div>
            <div className="terms-divider" />
            <div className="terms-line"><span>Guarantee needed ({guaranteePercent || "0"}%)</span><strong>{formatAmount(guaranteePreview)} mUSDC</strong></div>
            <div className="terms-line"><span>Interest shared with guarantors</span><strong>{formatAmount(guarantorRewardPreview)} mUSDC</strong></div>
            <p>Of the interest, {guarantorSharePercent || "0"}% is shared among guarantors in proportion to their guarantee. The lender receives principal plus the remaining interest.</p>
          </div>

          <button className="button button-primary button-full" onClick={requestLoan} disabled={busy || !eligibility || eligibility.maxLoanUsd === 0 || !address}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
            {busy ? step : "Create loan request"}
            {!busy && <ArrowRight size={15} />}
          </button>
          {formError && <div className="notice notice-error">{formError}</div>}
          {createdLoanId && <div className="notice notice-success"><Check size={15} /><span>Request created. <Link href={"/app/loan/" + createdLoanId}>Share the loan link <ArrowRight size={13} /></Link></span></div>}
          {hash && receipt.isSuccess && <a className="tx-link" href={explorerBaseUrl + "/tx/" + hash} target="_blank" rel="noreferrer">View request on Monad Explorer <ExternalLink size={13} /></a>}
          {error && !formError && <p className="action-error">{"shortMessage" in error ? String(error.shortMessage) : error.message}</p>}
        </section>

        <aside className="borrow-side">
          <div className="content-card borrow-steps-card"><span className="eyebrow">WHAT HAPPENS NEXT</span><h2>A request moves at your pace.</h2>
            <div className="journey-list">
              <Journey number="1" title="Guarantors commit" detail="People you trust can secure part of the request." active />
              <Journey number="2" title="A lender funds it" detail="Funding opens when guarantee coverage is complete." />
              <Journey number="3" title="You repay on time" detail="Your repayment is shared automatically by the contract." />
            </div>
          </div>
          <div className="content-card estimate-card"><span className="eyebrow">YOUR VERIFIED PROFILE</span>{eligibility ? <><div className="estimate-row"><div className="score-ring small"><span>{eligibility.score}</span><small>/100</small></div><div><strong>History score</strong><span>{eligibility.history.transactionCount.toLocaleString()} observed transactions</span></div></div><Link href="/app/verify" className="inline-link">Review assessment <ArrowRight size={13} /></Link></> : <><p>Wallet history gives lenders context about your onchain activity.</p><Link href="/app/verify" className="inline-link">Verify your history <ArrowRight size={13} /></Link></>}</div>
        </aside>
      </div>

      <section className="section-block">
        <div className="section-heading-row"><div><span className="eyebrow">YOUR BORROWING</span><h2>Loan requests & repayments</h2></div><span className="result-count">{loading ? "Updating…" : myLoans.length + (myLoans.length === 1 ? " loan" : " loans")}</span></div>
        {myLoans.length ? <div className="loan-grid">{myLoans.map((loan) => <LoanCard key={loan.id} loan={loan} action={loan.status === "Active" && address?.toLowerCase() === loan.borrower.toLowerCase() ? <LoanTransaction action="repay" loan={loan} onSuccess={refresh} compact /> : undefined} />)}</div> :
          <div className="empty-card compact-empty"><span className="empty-icon"><BadgeCheck size={19} /></span><h3>No borrowing activity yet</h3><p>After the loan is created, its guarantee progress and repayment status will appear here.</p></div>}
      </section>
    </div>
  );
}

function Journey({ number, title, detail, active = false }: { number: string; title: string; detail: string; active?: boolean }) {
  return <div className={active ? "journey-item active" : "journey-item"}><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></div>;
}

function parseAmountOrZero(amount: string) {
  try {
    return parseUnits(amount || "0", 6);
  } catch {
    return 0n;
  }
}

function formatAmount(amount: bigint) {
  return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(formatUnits(amount, 6)));
}
