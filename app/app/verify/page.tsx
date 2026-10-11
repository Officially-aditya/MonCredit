"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useSignMessage } from "wagmi";
import { getAddress, toHex } from "viem";
import { ArrowRight, BadgeCheck, Clock3, ExternalLink, FileCheck2, LoaderCircle, ShieldCheck, Wallet } from "lucide-react";
import { EligibilityAuthorization, readEligibility } from "@/lib/eligibility";
import { BorrowRequestDialog } from "@/components/borrow-request-dialog";

export default function VerifyPage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [ethereumAddress, setEthereumAddress] = useState("");
  const [eligibility, setEligibility] = useState<EligibilityAuthorization | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    if (address) {
      setEthereumAddress((current) => current || address);
      setEligibility(readEligibility(address));
    } else {
      setEligibility(null);
    }
  }, [address]);

  async function verify() {
    setError("");
    setEligibility(null);
    if (!address) {
      setError("Connect the Monad wallet you plan to use for borrowing.");
      return;
    }
    if (!ethereumAddress) {
      setError("Enter the Ethereum wallet whose history you want to check.");
      return;
    }
    setBusy(true);
    try {
      setStep("Preparing a wallet ownership message");
      const challengeResponse = await fetch("/api/verify-history/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ethereumAddress, borrowingAddress: address }),
      });
      const challengeData = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challengeData.error || "Could not prepare the verification message.");

      setStep("Waiting for your wallet signature");
      const signature = ethereumAddress.toLowerCase() === address.toLowerCase()
        ? await signMessageAsync({ message: challengeData.challenge })
        : await signWithEthereumWallet(challengeData.challenge, ethereumAddress);
      setStep("Reading Ethereum transfer history");
      const resultResponse = await fetch("/api/verify-history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ethereumAddress,
          borrowingAddress: address,
          challenge: challengeData.challenge,
          issuedAt: challengeData.issuedAt,
          signature,
        }),
      });
      const result = await resultResponse.json();
      if (!resultResponse.ok) throw new Error(result.error || "History verification failed.");
      window.localStorage.setItem("moncredit:eligibility:" + address.toLowerCase(), JSON.stringify(result));
      setEligibility(result as EligibilityAuthorization);
      setStep("History checked and authorization signed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "History verification failed.");
      setStep("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div><h1>Your history,<br className="mobile-break" /> explained.</h1><p>Check activity on Ethereum and get a clear, signed borrowing limit for your Monad wallet.</p></div>
        <div className="heading-note"><ShieldCheck size={16} /><span>Read-only check<br /><strong>No token approval required</strong></span></div>
      </div>

      <div className="verify-grid">
        <section className="open-section verify-form-section">
          <div className="section-heading"><h2>Link your Ethereum history</h2></div>
          <p className="section-description">Sign a one-time message to prove you control this Ethereum wallet and authorize its association with your connected Monad borrowing wallet.</p>
          <label className="form-label" htmlFor="eth-address">Ethereum wallet address</label>
          <input id="eth-address" className="form-input" value={ethereumAddress} onChange={(event) => setEthereumAddress(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
          <div className="address-binding"><span className="binding-icon"><BadgeCheck size={16} /></span><div><small>Borrowing wallet on Monad</small><strong>{address ? address : "Connect a wallet to continue"}</strong></div></div>
          <div className="signature-note"><ShieldCheck size={14} /><span>The signature is only proof of ownership. It does not authorize token transfers or spend your funds. If this is a different address, your browser wallet will ask to sign with that account.</span></div>
          <button className="button button-primary button-full" onClick={verify} disabled={busy || !address}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <BadgeCheck size={16} />}
            {busy ? step : "Verify history"}
            {!busy && <ArrowRight size={15} />}
          </button>
          {error && <div className="notice notice-open notice-error">{error}</div>}
          {step && !busy && !error && <div className="notice notice-open notice-success"><CheckMark />{step}</div>}
        </section>

        <aside className="open-section methodology-section">
          <div className="section-heading"><div><h2>Signals, not certainty</h2></div></div>
          <div className="method-list">
            <Method icon={<Clock3 size={16} />} title="Wallet age" detail="Time since the earliest observed transaction." />
            <Method icon={<FileCheck2 size={16} />} title="Activity patterns" detail="Transaction count and active calendar months." />
            <Method icon={<Wallet size={16} />} title="Supported assets" detail="Historical USDC, DAI, and WETH transfers and sampled balances." />
            <Method icon={<BadgeCheck size={16} />} title="Repayment history" detail="MonCredit repayments and defaults recorded on Monad." />
          </div>
          <div className="method-callout"><strong>What this score means</strong><p>A deterministic estimate of observable activity. It is not a credit bureau score, a promise of repayment, or financial advice.</p></div>
          <a className="inline-link" href="https://etherscan.io/" target="_blank" rel="noreferrer">Ethereum mainnet explorer <ExternalLink size={13} /></a>
        </aside>
      </div>

      {eligibility && (
        <section className="section-block assessment-section">
          <div className="section-heading-row"><div><h2>Verified wallet profile</h2></div><button className="button button-primary button-small" onClick={() => setRequestOpen(true)}>Request a loan <ArrowRight size={14} /></button></div>
          <div className="assessment-grid">
            <div className="open-section assessment-score-section">
              <div className="assessment-score">
                <div className="score-ring large"><span>{eligibility.score}</span><small>/100</small></div>
                <div><h3>{eligibility.score >= 70 ? "Established activity" : eligibility.score >= 40 ? "Growing activity" : eligibility.score >= 25 ? "Early activity" : "Limited signal"}</h3><p>This estimate summarizes the observable signals shown below.</p></div>
              </div>
              <div className="score-breakdown">
                <ScoreRow label="Wallet age" value={eligibility.scoreParts.walletAge} max={25} />
                <ScoreRow label="Transaction activity" value={eligibility.scoreParts.transactionActivity} max={25} />
                <ScoreRow label="Active months" value={eligibility.scoreParts.activeMonths} max={25} />
                <ScoreRow label="Supported asset history" value={eligibility.scoreParts.supportedAssetHistory} max={25} />
                <ScoreRow label="Repayment bonus" value={eligibility.scoreParts.repaymentBonus} max={20} />
                {eligibility.scoreParts.defaultPenalty > 0 && <ScoreRow label="Default history" value={eligibility.scoreParts.defaultPenalty} max={40} penalty />}
              </div>
            </div>
            <div className="assessment-side">
              <div className="open-section credit-limit-section"><h3>Estimated borrowing limit</h3><strong>{eligibility.maxLoanMon.toLocaleString()} MON</strong><span>Subject to loan terms</span><div className="limit-divider" /><small>Authorization valid until {new Date(Number(eligibility.eligibilityExpiry) * 1_000).toLocaleString()}</small></div>
              <div className="open-section history-facts">
                <Fact label="Wallet age" value={formatAge(eligibility.history.walletAgeDays)} />
                <Fact label="Observed transactions" value={eligibility.history.transactionCount.toLocaleString()} />
                <Fact label="Active months" value={eligibility.history.activeMonths.toString()} />
                <Fact label="Supported assets" value={eligibility.history.observedSupportedAssets.length ? eligibility.history.observedSupportedAssets.join(", ") : "None found"} />
                <Fact label="MonCredit repayments" value={eligibility.history.creditRecord.repaidCount.toString()} />
                <Fact label="MonCredit defaults" value={eligibility.history.creditRecord.defaultCount.toString()} />
              </div>
            </div>
          </div>
          {eligibility.history.historicalHoldings.length > 0 && (
            <div className="open-section snapshots-section"><div className="section-heading"><div><h3>Selected Ethereum blocks</h3></div></div>
              <div className="snapshot-list">{eligibility.history.historicalHoldings.map((snapshot) => <div key={snapshot.blockNumber} className="snapshot-row"><div><strong>Block {snapshot.blockNumber.toLocaleString()}</strong><span>{snapshot.timestamp ? new Date(snapshot.timestamp).toLocaleDateString() : "Date unavailable"}</span></div><span>{Number(snapshot.nativeEth).toFixed(4)} ETH</span><span>{snapshot.tokens.filter((token) => Number(token.balance) > 0).map((token) => Number(token.balance).toFixed(2) + " " + token.symbol).join(" · ") || "No supported token balance"}</span></div>)}</div>
            </div>
          )}
          {eligibility.warnings.length > 0 && <div className="notice notice-open notice-neutral"><Clock3 size={15} /><span>{eligibility.warnings.join(" ")}</span></div>}
          <p className="method-footnote">Method: {eligibility.history.methodologyVersion}. The asset snapshot shows up to three sampled blocks around observed activity; it does not represent a complete balance timeline. <a href="https://monad.xyz" target="_blank" rel="noreferrer">Learn about Monad <ExternalLink size={11} /></a></p>
        </section>
      )}
      <BorrowRequestDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}

function Method({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="method-item"><span>{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div>;
}

function ScoreRow({ label, value, max, penalty = false }: { label: string; value: number; max: number; penalty?: boolean }) {
  return <div className="score-row"><div><span>{label}</span><strong>{penalty ? "−" : ""}{value} <small>/ {max}</small></strong></div><div className="score-track"><i className={penalty ? "penalty" : ""} style={{ width: Math.min(100, value / max * 100) + "%" }} /></div></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="fact-row"><span>{label}</span><strong>{value}</strong></div>;
}

function formatAge(days: number) {
  if (days < 30) return days + " days";
  const months = Math.floor(days / 30);
  if (months < 12) return months + (months === 1 ? " month" : " months");
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return years + (years === 1 ? " year" : " years") + (remainingMonths ? ", " + remainingMonths + " mo" : "");
}

function CheckMark() {
  return <span className="success-check"><BadgeCheck size={14} /></span>;
}

async function signWithEthereumWallet(message: string, signerAddress: string) {
  type Provider = { request(args: { method: string; params: unknown[] }): Promise<string> };
  const provider = (window as Window & { ethereum?: Provider }).ethereum;
  if (!provider) throw new Error("This browser does not expose an Ethereum wallet for the address entered.");
  return provider.request({
    method: "personal_sign",
    params: [toHex(message), getAddress(signerAddress)],
  });
}
