import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";
import type { LoanRecord } from "@/lib/market";
import { formatMon } from "@/lib/mon";
import { StatusPill } from "@/components/status-pill";

export function LoanRow({ loan, action }: { loan: LoanRecord; action?: React.ReactNode }) {
  const coverage = loan.principal === 0n ? 0 : Number((loan.guaranteeTotal * 100n) / loan.principal);
  const progress = loan.requiredGuarantee === 0n ? 0 : Math.min(100, Number((loan.guaranteeTotal * 100n) / loan.requiredGuarantee));
  const unsecured = loan.principal > loan.requiredGuarantee ? loan.principal - loan.requiredGuarantee : 0n;
  const termDays = Math.ceil(loan.durationSeconds / 86_400);
  return (
    <article className="loan-row">
      <div className="loan-row-head">
        <div>
          <div className="loan-id-row"><span className="loan-id">Loan #{loan.id.padStart(4, "0")}</span><StatusPill status={loan.status} /></div>
          <Link href={"/app/loan/" + loan.id} className="loan-row-title"><span>{formatMon(loan.principal)} MON request</span><ArrowRight size={15} /></Link>
        </div>
        <div className="loan-amount"><strong>{formatMon(loan.principal)} MON</strong><small>principal</small></div>
      </div>
      <div className="loan-row-meta">
        <div><span>Borrower</span><strong>{shortAddress(loan.borrower)}</strong></div>
        <div><span>Interest</span><strong>{(loan.interestBps / 100).toFixed(1)}% total</strong></div>
        <div><span>Coverage</span><strong>{coverage}% secured</strong></div>
        <div><span>Unsecured at target</span><strong>{formatMon(unsecured)} MON</strong></div>
        <div><span>Term</span><strong>{termDays} days</strong></div>
      </div>
      <div className="loan-history-summary"><span className="history-score">{loan.eligibilityScore}<small>/100</small></span><span><strong>History score</strong><small>{formatAge(loan.walletAgeDays)} wallet · {loan.transactionCount.toLocaleString()} transactions · {loan.activeMonths} active months · {loan.supportedAssetCount} supported assets</small></span></div>
      {loan.status === "Open" && (
        <div className="guarantee-progress">
          <div className="progress-label"><span><Shield size={14} /> Guarantee pool</span><strong>{progress}%</strong></div>
          <div className="progress-track"><span style={{ width: progress + "%" }} /></div>
          <div className="progress-foot"><span>{formatMon(loan.guaranteeTotal)} MON committed</span><span>{formatMon(loan.requiredGuarantee)} MON target</span></div>
        </div>
      )}
      {action && <div className="loan-row-action">{action}</div>}
    </article>
  );
}

export function shortAddress(address?: string) {
  if (!address || address === "0x0000000000000000000000000000000000000000") return "Unavailable";
  return address.slice(0, 6) + "…" + address.slice(-4);
}

function formatAge(days: number) {
  if (days < 30) return days + "d";
  const months = Math.floor(days / 30);
  if (months < 12) return months + "mo";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return years + "y" + (remainder ? " " + remainder + "mo" : "");
}
