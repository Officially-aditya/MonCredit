import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiteLogo } from "@/components/site-logo";

export default function HomePage() {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <SiteLogo />
        <nav className="marketing-links" aria-label="Page sections">
          <a href="#how-it-works">How it works</a>
          <a href="#responsible-credit">Responsible credit</a>
        </nav>
        <div className="marketing-nav-actions">
          <Link href="/app" className="nav-app-link">Open app <ArrowUpRight size={14} /></Link>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <h1>Your Web3 history<br /><em>is worth something.</em></h1>
          <p>Fairer access to credit, backed by the reputation you have already built onchain. Borrow with a history, lend with clarity, or guarantee someone you believe in.</p>
          <div className="hero-actions">
            <Link href="/app/verify" className="button button-primary button-large">Check your borrowing power <ArrowRight size={16} /></Link>
            <a href="#how-it-works" className="text-action">See how it works <ArrowDownRight size={15} /></a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="dashboard-preview">
            <div className="preview-main">
              <div className="preview-title">Onchain profile <span className="preview-verified">Verified</span></div>
              <div className="preview-score-row"><div><span className="preview-metric-label">MonCredit score</span><strong>Pending<small> / 100</small></strong></div><div className="preview-score-ring"><span>Pending</span><small>history</small></div></div>
              <div className="preview-rule" />
              <div className="preview-data-row"><div><span>Wallet age</span><strong>Ethereum</strong></div><div><span>Credit limit</span><strong>Pending review</strong></div></div>
              <div className="preview-data-row"><div><span>History checked</span><strong>Historical activity</strong></div><div><span>Network</span><strong><i className="network-indicator" /> Monad</strong></div></div>
              <div className="preview-meter"><div><span>Activity profile</span><span>Personalized</span></div><div className="preview-meter-track"><i /><i /><i /><i /><i /></div></div>
            </div>
            <div className="preview-foot"><span>Secure wallet signature</span><span>No token approval</span></div>
          </div>
          <span className="floating-note note-left"><span><small>Borrow on your terms</small><strong>Clear, upfront pricing</strong></span></span>
          <span className="floating-note note-right"><span><small>Back each other</small><strong>Earn for a guarantee</strong></span></span>
        </div>
      </section>

      <section className="trust-strip">
        <span>Credit that sees more than collateral</span><span className="trust-divider" /><span>Ethereum history · Monad settlement · MON terms</span>
      </section>

      <section className="steps-section section-wrap" id="how-it-works">
        <div className="section-intro">
          <h2>Built around people,<br />not just their balance sheet.</h2>
          <p>MonCredit turns observable onchain activity into a transparent starting point for credit. Every role is optional. Every term is visible before you sign.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01</span>
            <h3>Borrow</h3><p>Verify your Ethereum history, then request a loan with clear repayment terms on Monad.</p><Link href="/app/verify">Check your profile <ArrowRight size={14} /></Link>
          </article>
          <article className="step-card">
            <span className="step-number">02</span>
            <h3>Guarantee</h3><p>Stake part of a borrower’s guarantee. See your maximum loss and potential reward first.</p><Link href="/app/market?view=guarantees">Explore guarantees <ArrowRight size={14} /></Link>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <h3>Lend</h3><p>Fund requests when the guarantee is in place. Earn the interest share shown in the loan terms.</p><Link href="/app/market?view=lending">View the market <ArrowRight size={14} /></Link>
          </article>
        </div>
      </section>

      <section className="responsible-section" id="responsible-credit">
        <div className="responsible-inner">
          <div><h2>History is a signal.<br />It is not a promise.</h2><p>Wallet age, transaction patterns, asset activity, and MonCredit repayment records inform an explainable estimate. They do not prove someone will repay. Lenders and guarantors see the terms and risks before they commit.</p></div>
          <Link href="/app" className="button button-light">Explore the app <ArrowRight size={15} /></Link>
        </div>
      </section>

      <footer className="marketing-footer"><SiteLogo /><span>MonCredit is an experimental credit protocol on Monad testnet. Test tokens have no monetary value.</span><span>© 2026 MonCredit</span></footer>
    </main>
  );
}
