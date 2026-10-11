"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Clipboard, Clock3, ExternalLink, HandCoins, LockKeyhole, Shield, Wallet } from "lucide-react";
import { formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { LoanTransaction } from "@/components/loan-transaction";
import { StatusPill } from "@/components/status-pill";
import { shortAddress } from "@/components/loan-card";
import { creditMarketAddress, type LoanRecord } from "@/lib/market";
import { fetchLoan } from "@/lib/market-data";
import { explorerBaseUrl } from "@/lib/chain";

export default function LoanDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const client = usePublicClient();
  const { address } = useAccount();
  const [loan, setLoan] = useState<LoanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Math.floor(Date.now() / 1_000));

  const refresh = useCallback(async () => {
    if (!id || !/^\d+$/.test(id)) {
      setLoan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchLoan(client, BigInt(id));
    setLoan(result);
    setLoading(false);
  }, [client, id]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1_000));
      void refresh();
    }, 20_000);
    return () => window.clearInterval(poll);
  }, [refresh]);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  if (loading) return <div className="workspace-page"><div className="loader-row"><span className="spinner" /> Loading loan from Monad testnet…</div></div>;
  if (!loan) return <div className="workspace-page"><Link href="/app/lend" className="inline-link"><ArrowLeft size={14} /> Back to lending</Link><div className="empty-card"><h2>Loan not found</h2><p>Check the link or connect to the network where this request was created.</p></div></div>;

  const principal = Number(formatUnits(loan.principal, 6));
  const totalInterest = loan.principal * BigInt(loan.interestBps) / 10_000n;
  const guarantorInterest = totalInterest * BigInt(loan.guarantorInterestBps) / 10_000n;
  const lenderInterest = totalInterest - guarantorInterest;
  const unsecuredAtTarget = loan.principal > loan.requiredGuarantee ? loan.principal - loan.requiredGuarantee : 0n;
  const remainingCoverage = loan.requiredGuarantee > loan.guaranteeTotal ? loan.requiredGuarantee - loan.guaranteeTotal : 0n;
  const expiredRequest = loan.status === "Open" && now > loan.requestDeadline;
  const due = loan.status === "Active" && now > loan.dueAt;
  const borrowerOwns = address?.toLowerCase() === loan.borrower.toLowerCase();
  const alreadyGuaranteed = Boolean(address && loan.guarantees.some((item) => item.address.toLowerCase() === address.toLowerCase()));

  return (
    <div className="workspace-page">
      <Link href="/app/lend" className="back-link"><ArrowLeft size={14} /> Back to market</Link>
      <div className="page-heading loan-detail-heading">
        <div><span className="eyebrow">LOAN #{loan.id.padStart(4, "0")}</span><h1>{"$"}{principal.toLocaleString("en-US", { maximumFractionDigits: 2 })} mUSDC request</h1><p>Review the borrower, guarantee pool, and repayment split before taking action.</p></div>
        <div className="loan-detail-actions"><StatusPill status={loan.status} /><button className="button button-secondary button-small" onClick={copyLink}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Link copied" : "Share request"}</button></div>
      </div>

      {!creditMarketAddress && <div className="notice notice-neutral">Connect the deployed market contract address to load this request from Monad testnet.</div>}

      <div className="loan-detail-grid">
        <div className="loan-detail-primary">
          <section className="content-card loan-overview-card">
            <div className="loan-overview-amount"><span>REQUESTED PRINCIPAL</span><strong>{"$"}{principal.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong><small>mUSDC</small></div>
            <div className="loan-overview-stats">
              <DetailFact icon={<Clock3 size={15} />} label="Repayment term" value={loan.dueAt ? formatDate(loan.dueAt) : Math.ceil(loan.durationSeconds / 86_400) + " days after funding"} />
              <DetailFact icon={<HandCoins size={15} />} label="Interest rate" value={(loan.interestBps / 100).toFixed(1) + "% flat"} />
              <DetailFact icon={<Shield size={15} />} label="Guarantee required" value={formatMoney(loan.requiredGuarantee) + " mUSDC"} />
              <DetailFact icon={<LockKeyhole size={15} />} label="Lender exposure at target" value={formatMoney(unsecuredAtTarget) + " mUSDC unsecured"} />
              <DetailFact icon={<CalendarDays size={15} />} label="Request closes" value={formatDate(loan.requestDeadline)} />
            </div>
          </section>

          <section className="content-card borrower-history-card">
            <div className="card-heading"><div><span className="eyebrow">BORROWER HISTORY</span><h2>Snapshot at request time</h2></div><span className="card-icon"><Shield size={17} /></span></div>
            <div className="borrower-history-body">
              <div className="score-ring large"><span>{loan.eligibilityScore}</span><small>/100</small></div>
              <div className="borrower-history-metrics">
                <div><span>Wallet age</span><strong>{formatAge(loan.walletAgeDays)}</strong></div>
                <div><span>Observed transactions</span><strong>{loan.transactionCount.toLocaleString()}</strong></div>
                <div><span>Active months</span><strong>{loan.activeMonths}</strong></div>
                <div><span>Supported assets</span><strong>{loan.supportedAssetCount}</strong></div>
              </div>
            </div>
            <p className="small-note">History is an estimate of observable Ethereum activity, not proof of creditworthiness. Score and summary were signed when this request was created.</p>
            <div className="history-hash"><span>History fingerprint</span><code title={loan.historyHash}>{loan.historyHash}</code></div>
          </section>

          <section className="content-card guarantee-detail-card">
            <div className="card-heading"><div><span className="eyebrow">GUARANTEE POOL</span><h2>Collateral commitments</h2></div><span className="card-icon"><Shield size={17} /></span></div>
            <div className="pool-amounts"><div><span>Committed</span><strong>{formatMoney(loan.guaranteeTotal)} <small>mUSDC</small></strong></div><div><span>Coverage target</span><strong>{formatMoney(loan.requiredGuarantee)} <small>mUSDC</small></strong></div></div>
            <div className="progress-track detail-progress"><span style={{ width: (loan.requiredGuarantee ? Number(loan.guaranteeTotal * 100n / loan.requiredGuarantee) : 0) + "%" }} /></div>
            <div className="progress-foot"><span>{loan.guarantees.length} guarantor{loan.guarantees.length === 1 ? "" : "s"}</span><span>{loan.requiredGuarantee ? Number(loan.guaranteeTotal * 100n / loan.requiredGuarantee) : 0}% secured</span></div>
            {loan.guarantees.length > 0 && <div className="guarantor-list">{loan.guarantees.map((guarantor) => <div className="guarantor-row" key={guarantor.address}><span className="guarantor-avatar"><Shield size={14} /></span><span>{shortAddress(guarantor.address)}</span><strong>{formatMoney(guarantor.amount)} mUSDC</strong></div>)}</div>}
            {loan.status === "Open" && !expiredRequest && remainingCoverage > 0n && !borrowerOwns && <LoanTransaction action="guarantee" loan={loan} onSuccess={refresh} />}
            {alreadyGuaranteed && loan.status === "Open" && <p className="small-note">You have already committed to this guarantee pool. Additional commitments are available from the same request page.</p>}
          </section>

          <section className="content-card repayment-detail-card">
            <div className="card-heading"><div><span className="eyebrow">REPAYMENT SPLIT</span><h2>Where the interest goes</h2></div></div>
            <div className="repayment-total"><span>Borrower repays</span><strong>{formatMoney(loan.principal + totalInterest)} mUSDC</strong></div>
            <div className="repayment-distribution">
              <div><span className="distribution-dot lender-dot" /><span>Lender receives</span><strong>{formatMoney(loan.principal + lenderInterest)} mUSDC</strong><small>Principal + {formatMoney(lenderInterest)} interest</small></div>
              <div><span className="distribution-dot guarantor-dot" /><span>Guarantors share</span><strong>{formatMoney(loan.guaranteeTotal + guarantorInterest)} mUSDC</strong><small>Collateral returned + {formatMoney(guarantorInterest)} interest</small></div>
            </div>
            <p className="small-note">Guarantor rewards are split in proportion to each collateral commitment. If the borrower defaults, the guarantee pool goes to the lender and remaining principal loss stays with the lender.</p>
          </section>
        </div>

        <aside className="loan-detail-side">
          <section className="content-card participants-card">
            <div className="card-heading"><div><span className="eyebrow">PARTICIPANTS</span><h2>Loan parties</h2></div></div>
            <Participant icon={<Wallet size={15} />} role="Borrower" address={loan.borrower} />
            <Participant icon={<HandCoins size={15} />} role="Lender" address={loan.lender} />
          </section>
          <section className="content-card action-panel">
            <div className="card-heading"><div><span className="eyebrow">NEXT STEP</span><h2>{actionTitle(loan.status, expiredRequest, due, borrowerOwns)}</h2></div></div>
            {loan.status === "Open" && !expiredRequest && (
              <div className="available-actions">
                {loan.guaranteeTotal >= loan.requiredGuarantee && !borrowerOwns && !alreadyGuaranteed && loan.lender === "0x0000000000000000000000000000000000000000" && <LoanTransaction action="fund" loan={loan} onSuccess={refresh} />}
                {loan.guaranteeTotal >= loan.requiredGuarantee && alreadyGuaranteed && <p className="small-note">You are part of the guarantee pool, so you cannot also fund this request.</p>}
                {loan.guaranteeTotal < loan.requiredGuarantee && <p className="small-note">The request needs {formatMoney(remainingCoverage)} more mUSDC in guarantees before a lender can fund it.</p>}
                {!borrowerOwns && !alreadyGuaranteed && loan.guaranteeTotal < loan.requiredGuarantee && <p className="small-note">You can provide part or all of the remaining collateral in the guarantee panel.</p>}
                {borrowerOwns && <p className="small-note">Share this request with guarantors. Once coverage is complete, a lender can fund it.</p>}
              </div>
            )}
            {expiredRequest && <LoanTransaction action="cancel" loan={loan} onSuccess={refresh} />}
            {loan.status === "Active" && due && <LoanTransaction action="default" loan={loan} onSuccess={refresh} />}
            {loan.status === "Active" && !due && borrowerOwns && <LoanTransaction action="repay" loan={loan} onSuccess={refresh} />}
            {loan.status === "Active" && !due && !borrowerOwns && <p className="small-note">This loan is due {formatDate(loan.dueAt)}. Default settlement opens after the due date.</p>}
            {loan.status === "Repaid" && <div className="action-final"><Check size={16} /><span>Repaid in full. Lender and guarantors were settled automatically.</span></div>}
            {loan.status === "Defaulted" && <div className="action-final risk"><Shield size={16} /><span>Default settled. Locked collateral was applied to the lender’s loss.</span></div>}
            {loan.status === "Cancelled" && <div className="action-final"><Check size={16} /><span>Request closed. Guarantee commitments have been returned.</span></div>}
          </section>
        </aside>
      </div>
      <div className="loan-contract-link"><span>Contract</span><a href={explorerBaseUrl + "/address/" + creditMarketAddress} target="_blank" rel="noreferrer">{shortAddress(creditMarketAddress)} <ArrowUpRight size={13} /></a><span>All actions settle on Monad testnet.</span></div>
    </div>
  );
}

function DetailFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="detail-fact"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function Participant({ icon, role, address }: { icon: React.ReactNode; role: string; address: string }) {
  const empty = address === "0x0000000000000000000000000000000000000000";
  return <div className="participant-row"><span className="participant-icon">{icon}</span><div><small>{role}</small><strong>{empty ? "Awaiting funding" : shortAddress(address)}</strong></div>{!empty && <a href={explorerBaseUrl + "/address/" + address} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>}</div>;
}

function formatMoney(amount: bigint) {
  return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(formatUnits(amount, 6)));
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1_000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAge(days: number) {
  if (days < 30) return days + (days === 1 ? " day" : " days");
  const months = Math.floor(days / 30);
  if (months < 12) return months + (months === 1 ? " month" : " months");
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return years + (years === 1 ? " year" : " years") + (remainingMonths ? ", " + remainingMonths + " mo" : "");
}

function actionTitle(status: LoanRecord["status"], expired: boolean, due: boolean, borrower: boolean) {
  if (status === "Open" && expired) return "Return guarantees";
  if (status === "Open") return "Request is open";
  if (status === "Active" && due) return "Settle the default";
  if (status === "Active" && borrower) return "Complete repayment";
  if (status === "Active") return "Loan in progress";
  if (status === "Repaid") return "Loan completed";
  if (status === "Defaulted") return "Default recorded";
  return "Request cancelled";
}
