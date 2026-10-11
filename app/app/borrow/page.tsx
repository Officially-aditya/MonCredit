"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAccount } from "wagmi";
import { BorrowRequestDialog } from "@/components/borrow-request-dialog";
import { LoanRow } from "@/components/loan-row";
import { LoanTransaction } from "@/components/loan-transaction";
import { useMarketLoans } from "@/components/market-hooks";

export default function BorrowPage() {
  const { address } = useAccount();
  const { loans, loading, refresh } = useMarketLoans();
  const [requestOpen, setRequestOpen] = useState(false);
  const myLoans = address
    ? loans.filter((loan) => loan.borrower.toLowerCase() === address.toLowerCase())
    : [];

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div><h1>Your borrowing</h1><p>Track loan requests, guarantee progress, and repayments.</p></div>
      </div>

      <section className="section-block borrowing-activity">
        <div className="section-heading-row">
          <div><h2>Loan activity</h2></div>
          <div className="borrow-activity-actions">
            <span className="result-count">{loading ? "Updating…" : myLoans.length + (myLoans.length === 1 ? " loan" : " loans")}</span>
            <button className="button button-primary button-small" onClick={() => setRequestOpen(true)}>Request a loan <ArrowRight size={14} /></button>
          </div>
        </div>
        {loading ? <div className="loader-row"><span className="spinner" /> Reading Monad testnet…</div> : myLoans.length ? (
          <div className="loan-list">{myLoans.map((loan) => <LoanRow key={loan.id} loan={loan} action={loan.status === "Active" ? <LoanTransaction action="repay" loan={loan} onSuccess={refresh} compact /> : undefined} />)}</div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>No borrowing activity yet</h3>
            <p>Your requests and repayment status will appear here.</p>
          </div>
        )}
      </section>

      <BorrowRequestDialog open={requestOpen} onClose={() => setRequestOpen(false)} onSuccess={refresh} />
    </div>
  );
}
