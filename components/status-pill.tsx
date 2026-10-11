import type { LoanStatus } from "@/lib/market";

export function StatusPill({ status }: { status: LoanStatus }) {
  const style =
    status === "Active" || status === "Open"
      ? "status-pill status-live"
      : status === "Repaid"
        ? "status-pill status-done"
        : status === "Defaulted"
          ? "status-pill status-risk"
          : "status-pill status-muted";
  return <span className={style}><span />{status}</span>;
}
