"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Clock3, Coins, HandCoins, Info, ShieldCheck, Wallet } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { LoanRow } from "@/components/loan-row";
import { WalletTools } from "@/components/wallet-tools";
import { BorrowRequestDialog } from "@/components/borrow-request-dialog";
import { useMarketLoans } from "@/components/market-hooks";
import { creditMarketAbi, creditMarketAddress } from "@/lib/market";
import { readEligibility, type EligibilityAuthorization } from "@/lib/eligibility";
import { formatMon } from "@/lib/mon";

export default function DashboardPage() {
  const { address } = useAccount();
  const { loans, loading, refresh } = useMarketLoans();
  const [eligibility, setEligibility] = useState<EligibilityAuthorization | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const record = useReadContract({
    address: creditMarketAddress,
    abi: creditMarketAbi,
    functionName: "userCreditRecord",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && creditMarketAddress) },
  });

  useEffect(() => {
    setEligibility(readEligibility(address));
  }, [address]);

  const personal = useMemo(() => {
    if (!address) return { borrowed: [], lent: [], guaranteed: [] };
    const wallet = address.toLowerCase();
    return {
      borrowed: loans.filter((loan) => loan.borrower.toLowerCase() === wallet),
      lent: loans.filter((loan) => loan.lender.toLowerCase() === wallet),
      guaranteed: loans.filter((loan) => loan.guarantees.some((item) => item.address.toLowerCase() === wallet)),
    };
  }, [address, loans]);
  const outstanding = personal.borrowed.filter((loan) => loan.status === "Active").reduce((sum, loan) => sum + loan.principal, 0n);
  const activeLent = personal.lent.filter((loan) => loan.status === "Active").reduce((sum, loan) => sum + loan.principal, 0n);
  const guaranteeExposure = personal.guaranteed
    .filter((loan) => loan.status === "Active" || loan.status === "Open")
    .reduce((sum, loan) => sum + (loan.guarantees.find((item) => item.address.toLowerCase() === address?.toLowerCase())?.amount ?? 0n), 0n);
  const recent = [...personal.borrowed, ...personal.lent, ...personal.guaranteed].filter(
    (loan, index, list) => list.findIndex((candidate) => candidate.id === loan.id) === index,
  ).slice(0, 3);

  return (
    <div className="workspace-page">
      <div className="page-heading dashboard-heading">
        <div><h1>Good to see you<span className="heading-period">.</span></h1><p>One clear view of the credit you’re building onchain.</p></div>
        <button className="button button-primary" onClick={() => setRequestOpen(true)}><Wallet size={16} /> Request a loan</button>
      </div>

      {!creditMarketAddress && <div className="notice notice-open notice-neutral"><Info size={16} /><span><strong>Testnet setup</strong>: deploy CreditMarket and add its address to .env.local to enable live reads and transactions.</span></div>}

      <div className="metric-grid">
        <Metric icon={<Coins size={17} />} label="Available to borrow" value={eligibility ? eligibility.maxLoanMon.toLocaleString() + " MON" : "Pending"} foot={eligibility ? "Based on your verified profile" : "Verify your Ethereum history"} tone="violet" />
        <Metric icon={<Wallet size={17} />} label="Active borrowing" value={formatMon(outstanding) + " MON"} foot={personal.borrowed.filter((loan) => loan.status === "Active").length + " active loans"} tone="blue" />
        <Metric icon={<HandCoins size={17} />} label="Lent to borrowers" value={formatMon(activeLent) + " MON"} foot={personal.lent.filter((loan) => loan.status === "Active").length + " active positions"} tone="green" />
        <Metric icon={<ShieldCheck size={17} />} label="Guarantees at risk" value={formatMon(guaranteeExposure) + " MON"} foot="Returned after repayment" tone="amber" />
      </div>

      <div className="dashboard-grid">
        <section className="open-section wallet-panel">
          <div className="section-heading"><h2>Your MON balance</h2></div>
          <WalletTools />
        </section>
        <section className="open-section credit-panel">
          <div className="section-heading"><h2>{eligibility ? "History verified" : "Start with your history"}</h2></div>
          {eligibility ? (
            <div className="profile-content">
              <div className="score-block"><div className="score-ring"><span>{eligibility.score}</span><small>/100</small></div><div><strong>History score</strong><span>{eligibility.history.transactionCount.toLocaleString()} observed transactions · {eligibility.history.activeMonths} active months</span></div></div>
              <div className="credit-limit-row"><span>Estimated borrowing limit</span><strong>{eligibility.maxLoanMon.toLocaleString()} MON</strong></div>
              <Link href="/app/verify" className="inline-link">Review your assessment <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="profile-empty"><p>Connect a wallet and verify your Ethereum activity to see an explainable borrowing estimate.</p><Link href="/app/verify" className="button button-secondary button-small">Verify wallet history <ArrowRight size={14} /></Link></div>
          )}
        </section>
      </div>

      <section className="section-block">
        <div className="section-heading-row"><div><h2>Recent activity</h2></div><Link href="/app/market?view=lending" className="inline-link">Explore loans <ArrowRight size={14} /></Link></div>
        {recent.length ? <div className="loan-list">{recent.map((loan) => <LoanRow key={loan.id} loan={loan} action={loan.status === "Active" && address?.toLowerCase() === loan.borrower.toLowerCase() ? <Link className="inline-link" href={"/app/loan/" + loan.id}>{loan.dueAt <= Math.floor(Date.now() / 1_000) ? "Settle default" : "Repay loan"} <ArrowRight size={13} /></Link> : undefined} />)}</div> : (
          <div className="empty-state">
            {loading ? <div className="loader-row"><span className="spinner" /> Reading Monad testnet…</div> : <><h3>Your activity will show up here</h3><p>Once you borrow, guarantee, or fund a loan, its onchain status appears in this workspace.</p><Link href="/app/market?view=lending" className="inline-link">Browse the lending market <ArrowRight size={14} /></Link></>}
          </div>
        )}
      </section>

      {record.data && (
        <div className="quiet-footnote">
          <span>Repayments recorded</span><strong>{Number(record.data[0])}</strong>
          <span>Defaults recorded</span><strong>{Number(record.data[1])}</strong>
          <span>All time borrowed</span><strong>{formatMon(record.data[2])} MON</strong>
        </div>
      )}
      <BorrowRequestDialog open={requestOpen} onClose={() => setRequestOpen(false)} onSuccess={refresh} />
    </div>
  );
}

function Metric({ icon, label, value, foot, tone }: { icon: React.ReactNode; label: string; value: string; foot: string; tone: string }) {
  return <article className="metric"><span className={"metric-icon " + tone}>{icon}</span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-foot">{foot}</span></article>;
}
