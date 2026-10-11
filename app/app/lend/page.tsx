"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowRight, HandCoins, Info, LockKeyhole, ShieldCheck } from "lucide-react";
import { formatUnits } from "viem";
import { LoanCard } from "@/components/loan-card";
import { LoanTransaction } from "@/components/loan-transaction";
import { useMarketLoans } from "@/components/market-hooks";

export default function LendPage() {
  const { address } = useAccount();
  const { loans, loading, refresh } = useMarketLoans();
  const open = loans.filter(
    (loan) =>
      loan.status === "Open" &&
      loan.requestDeadline >= Math.floor(Date.now() / 1_000) &&
      loan.borrower.toLowerCase() !== address?.toLowerCase(),
  );
  const ready = open.filter((loan) => loan.guaranteeTotal >= loan.requiredGuarantee);
  const myLending = address
    ? loans.filter((loan) => loan.lender.toLowerCase() === address.toLowerCase())
    : [];
  const activePrincipal = myLending.filter((loan) => loan.status === "Active").reduce((sum, loan) => sum + loan.principal, 0n);
  const possibleInterest = ready.reduce((sum, loan) => sum + loan.principal * BigInt(loan.interestBps - Math.floor(loan.interestBps * loan.guarantorInterestBps / 10_000)) / 10_000n, 0n);

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div><span className="eyebrow">LEND</span><h1>Put your mUSDC to work.</h1><p>Fund an individual request after its guarantee pool reaches the stated coverage target.</p></div>
        <div className="heading-note"><HandCoins size={16} /><span>Your active lending<br /><strong>{"$"}{Number(formatUnits(activePrincipal, 6)).toLocaleString()} mUSDC</strong></span></div>
      </div>

      <div className="lender-explainer content-card">
        <span className="explainer-icon"><LockKeyhole size={17} /></span>
        <div><strong>Funding requires full guarantee coverage</strong><p>The contract will only accept a loan when the guarantee pool meets its target. Interest is split between you and the guarantors automatically at repayment.</p></div>
        <div className="explainer-potential"><span>Interest on ready requests</span><strong>{"$"}{Number(formatUnits(possibleInterest, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong><small>if all are funded and repaid</small></div>
      </div>

      <section className="section-block">
        <div className="section-heading-row"><div><span className="eyebrow">LENDING MARKET</span><h2>Open requests</h2></div><span className="result-count">{loading ? "Updating…" : open.length + " requests"}</span></div>
        {open.length ? <div className="loan-grid">{open.map((loan) => {
          const coverageReady = loan.guaranteeTotal >= loan.requiredGuarantee;
          const alreadyGuaranteed = Boolean(address && loan.guarantees.some((item) => item.address.toLowerCase() === address.toLowerCase()));
          return <LoanCard key={loan.id} loan={loan} action={coverageReady && alreadyGuaranteed
            ? <button className="button button-disabled button-small" disabled><ShieldCheck size={15} />Already guaranteeing</button>
            : coverageReady ? <LoanTransaction action="fund" loan={loan} onSuccess={refresh} compact />
            : <button className="button button-disabled button-small" disabled><ShieldCheck size={15} />Waiting for guarantees</button>} />;
        })}</div> :
          <div className="empty-card"><span className="empty-icon"><HandCoins size={19} /></span><h3>No requests in the market yet</h3><p>Borrowers’ requests appear here after they have been created. You can review terms before funding.</p><Link href="/app/borrow" className="inline-link">Create a request <ArrowRight size={14} /></Link></div>}
      </section>

      <section className="section-block">
        <div className="section-heading-row"><div><span className="eyebrow">YOUR LENDING</span><h2>Loans you’ve funded</h2></div><span className="result-count">{myLending.length} positions</span></div>
        {myLending.length ? <div className="loan-grid">{myLending.map((loan) => <LoanCard key={loan.id} loan={loan} />)}</div> :
          <div className="empty-card compact-empty"><span className="empty-icon"><Info size={18} /></span><h3>No lending positions yet</h3><p>When you fund a request, it will be recorded here with the repayment terms.</p></div>}
      </section>
    </div>
  );
}
