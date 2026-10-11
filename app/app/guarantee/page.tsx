"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowRight, Info, Shield, ShieldCheck } from "lucide-react";
import { formatUnits } from "viem";
import { LoanRow } from "@/components/loan-row";
import { LoanTransaction } from "@/components/loan-transaction";
import { useMarketLoans } from "@/components/market-hooks";

export default function GuaranteePage() {
  const { address } = useAccount();
  const { loans, loading, refresh } = useMarketLoans();
  const open = loans.filter(
    (loan) =>
      loan.status === "Open" &&
      loan.requestDeadline >= Math.floor(Date.now() / 1_000) &&
      loan.borrower.toLowerCase() !== address?.toLowerCase() &&
      loan.guaranteeTotal < loan.requiredGuarantee,
  );
  const positions = address
    ? loans
        .filter((loan) => loan.guarantees.some((item) => item.address.toLowerCase() === address.toLowerCase()))
        .map((loan) => ({
          loan,
          amount: loan.guarantees.find((item) => item.address.toLowerCase() === address.toLowerCase())?.amount ?? 0n,
        }))
    : [];
  const locked = positions
    .filter((item) => item.loan.status === "Open" || item.loan.status === "Active")
    .reduce((sum, item) => sum + item.amount, 0n);

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div><h1>Back someone’s next step.</h1><p>Provide a collateral-backed guarantee. Know exactly what is at risk and what you can earn.</p></div>
        <div className="heading-note"><ShieldCheck size={16} /><span>Potential reward<br /><strong>40% of the interest pool</strong></span></div>
      </div>
      <div className="guarantee-summary open-section">
        <div><span className="value-label">Active exposure</span><strong>{"$"}{Number(formatUnits(locked, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })} mUSDC</strong><p>Collateral is locked until the borrower repays, the request expires, or the loan defaults.</p></div>
        <div className="summary-risk"><Info size={14} /><span>On default, committed collateral may be used to compensate the lender. You can lose the full guarantee amount.</span></div>
      </div>

      <section className="section-block">
        <div className="section-heading-row"><div><h2>Requests seeking a guarantee</h2></div><span className="result-count">{loading ? "Updating…" : open.length + " available"}</span></div>
        {open.length ? <div className="loan-list">{open.map((loan) => <LoanRow key={loan.id} loan={loan} action={<LoanTransaction action="guarantee" loan={loan} onSuccess={refresh} compact />} />)}</div> :
          <div className="empty-state"><h3>No open guarantees to review</h3><p>New borrower requests will appear here. You can also share a loan request with someone you trust.</p><Link href="/app/lend" className="inline-link">Explore the lending market <ArrowRight size={14} /></Link></div>}
      </section>

      <section className="section-block">
        <div className="section-heading-row"><div><h2>Guarantees you’ve made</h2></div><span className="result-count">{positions.length} positions</span></div>
        {positions.length ? <div className="loan-list">{positions.map(({ loan, amount }) => <LoanRow key={loan.id} loan={loan} action={<div className="guarantee-position-note"><span>Your commitment</span><strong>{"$"}{Number(formatUnits(amount, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })} mUSDC</strong></div>} />)}</div> :
          <div className="empty-state compact-empty"><h3>No guarantee positions yet</h3><p>Review open requests above and see the exposure and reward before you commit.</p></div>}
      </section>
    </div>
  );
}
