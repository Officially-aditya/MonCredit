"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ArrowRight, HandCoins, Info, ShieldCheck } from "lucide-react";
import { BorrowRequestDialog } from "@/components/borrow-request-dialog";
import { LoanRow } from "@/components/loan-row";
import { LoanTransaction } from "@/components/loan-transaction";
import { useMarketLoans } from "@/components/market-hooks";
import { formatMon } from "@/lib/mon";

type MarketView = "guarantees" | "lending";

export default function MarketPage() {
  const { address } = useAccount();
  const { loans, loading, refresh } = useMarketLoans();
  const [view, setView] = useState<MarketView>("guarantees");
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "lending" || requestedView === "guarantees") setView(requestedView);
  }, []);

  const openGuarantees = loans.filter((loan) =>
    loan.status === "Open" &&
    loan.requestDeadline >= Math.floor(Date.now() / 1_000) &&
    loan.borrower.toLowerCase() !== address?.toLowerCase() &&
    loan.guaranteeTotal < loan.requiredGuarantee,
  );
  const guarantees = address
    ? loans
        .filter((loan) => loan.guarantees.some((item) => item.address.toLowerCase() === address.toLowerCase()))
        .map((loan) => ({
          loan,
          amount: loan.guarantees.find((item) => item.address.toLowerCase() === address.toLowerCase())?.amount ?? 0n,
        }))
    : [];
  const activeExposure = guarantees
    .filter(({ loan }) => loan.status === "Open" || loan.status === "Active")
    .reduce((sum, item) => sum + item.amount, 0n);
  const readyToFund = loans.filter((loan) =>
    loan.status === "Open" &&
    loan.requestDeadline >= Math.floor(Date.now() / 1_000) &&
    loan.borrower.toLowerCase() !== address?.toLowerCase() &&
    loan.guaranteeTotal >= loan.requiredGuarantee,
  );
  const myLending = address
    ? loans.filter((loan) => loan.lender.toLowerCase() === address.toLowerCase())
    : [];
  const activeLending = myLending.filter((loan) => loan.status === "Active").reduce((sum, loan) => sum + loan.principal, 0n);
  const possibleInterest = readyToFund.reduce(
    (sum, loan) => sum + loan.principal * BigInt(loan.interestBps - Math.floor(loan.interestBps * loan.guarantorInterestBps / 10_000)) / 10_000n,
    0n,
  );

  function selectView(nextView: MarketView) {
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div><h1>Loan market</h1><p>Review guarantee requests or fund loans with full coverage.</p></div>
        {view === "guarantees" ? (
          <div className="heading-note"><ShieldCheck size={16} /><span>Active guarantees<br /><strong>{formatMon(activeExposure)} MON</strong></span></div>
        ) : (
          <div className="heading-note"><HandCoins size={16} /><span>Active lending<br /><strong>{formatMon(activeLending)} MON</strong></span></div>
        )}
      </div>

      <div className="market-tabs" role="tablist" aria-label="Loan market actions">
        <button className={view === "guarantees" ? "market-tab active" : "market-tab"} role="tab" aria-selected={view === "guarantees"} onClick={() => selectView("guarantees")}>Guarantees <span>{loading ? "…" : openGuarantees.length}</span></button>
        <button className={view === "lending" ? "market-tab active" : "market-tab"} role="tab" aria-selected={view === "lending"} onClick={() => selectView("lending")}>Lending <span>{loading ? "…" : readyToFund.length}</span></button>
      </div>

      {view === "guarantees" ? (
        <>
          <div className="market-risk open-section">
            <div><span className="value-label">Collateral at risk</span><p>On default, committed collateral may be used to compensate the lender. A guarantee can lose its full amount.</p></div>
            <Info size={15} aria-hidden="true" />
          </div>
          <section className="section-block">
            <div className="section-heading-row"><div><h2>Requests seeking a guarantee</h2></div><span className="result-count">{loading ? "Updating…" : openGuarantees.length + " available"}</span></div>
            {openGuarantees.length ? <div className="loan-list">{openGuarantees.map((loan) => <LoanRow key={loan.id} loan={loan} action={<LoanTransaction action="guarantee" loan={loan} onSuccess={refresh} compact />} />)}</div> :
              <div className="empty-state"><h3>No open guarantees to review</h3><p>New requests will appear here when borrowers ask for support.</p><button className="inline-link market-inline-button" onClick={() => selectView("lending")}>View covered loans <ArrowRight size={14} /></button></div>}
          </section>
          <section className="section-block">
            <div className="section-heading-row"><div><h2>Your guarantees</h2></div><span className="result-count">{guarantees.length} positions</span></div>
            {guarantees.length ? <div className="loan-list">{guarantees.map(({ loan, amount }) => <LoanRow key={loan.id} loan={loan} action={<div className="guarantee-position-note"><span>Your commitment</span><strong>{formatMon(amount)} MON</strong></div>} />)}</div> :
              <div className="empty-state compact-empty"><h3>No guarantee positions yet</h3><p>When you back a request, your exposure and reward terms will appear here.</p></div>}
          </section>
        </>
      ) : (
        <>
          <div className="lender-explainer open-section">
            <span className="explainer-rule" aria-hidden="true" />
            <div><strong>Funding requires full guarantee coverage</strong><p>The contract only accepts a loan when its coverage target is met. Interest is split between the lender and guarantors at repayment.</p></div>
            <div className="explainer-potential"><span>Interest on ready requests</span><strong>{formatMon(possibleInterest)} MON</strong><small>if all are funded and repaid</small></div>
          </div>
          <section className="section-block">
            <div className="section-heading-row"><div><h2>Loans ready to fund</h2></div><span className="result-count">{loading ? "Updating…" : readyToFund.length + " ready"}</span></div>
            {readyToFund.length ? <div className="loan-list">{readyToFund.map((loan) => {
              const alreadyGuaranteed = Boolean(address && loan.guarantees.some((item) => item.address.toLowerCase() === address.toLowerCase()));
              return <LoanRow key={loan.id} loan={loan} action={alreadyGuaranteed
                ? <button className="button button-disabled button-small" disabled><ShieldCheck size={15} />Already guaranteeing</button>
                : <LoanTransaction action="fund" loan={loan} onSuccess={refresh} compact />} />;
            })}</div> :
              <div className="empty-state"><h3>No loans ready to fund</h3><p>Covered loan requests will appear here once they are ready.</p><button className="inline-link market-inline-button" onClick={() => setRequestOpen(true)}>Request a loan <ArrowRight size={14} /></button></div>}
          </section>
          <section className="section-block">
            <div className="section-heading-row"><div><h2>Loans you’ve funded</h2></div><span className="result-count">{myLending.length} positions</span></div>
            {myLending.length ? <div className="loan-list">{myLending.map((loan) => <LoanRow key={loan.id} loan={loan} />)}</div> :
              <div className="empty-state compact-empty"><h3>No lending positions yet</h3><p>Loans you fund will be recorded here with their repayment terms.</p></div>}
          </section>
        </>
      )}

      <BorrowRequestDialog open={requestOpen} onClose={() => setRequestOpen(false)} onSuccess={refresh} />
    </div>
  );
}
