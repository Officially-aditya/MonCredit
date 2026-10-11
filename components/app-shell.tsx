"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  HandCoins,
  LayoutDashboard,
  LifeBuoy,
  Wallet,
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiteLogo } from "@/components/site-logo";

const navigation = [
  { label: "Overview", href: "/app", icon: LayoutDashboard },
  { label: "Proof of wealth", href: "/app/verify", icon: BadgeCheck },
  { label: "Borrow", href: "/app/borrow", icon: Wallet },
  { label: "Market", href: "/app/market", icon: HandCoins },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <div className="sidebar-top">
          <SiteLogo href="/app" />
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navigation.map(({ label, href, icon: Icon }) => {
              const active = href === "/app" ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={active ? "nav-link active" : "nav-link"}>
                  <Icon size={17} strokeWidth={1.9} />
                  <span>{label}</span>
                  {active && <span className="nav-dot" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="network-status">
            <span className="network-indicator" />
            <div><strong>Monad testnet</strong><small>mUSDC lending · test mode</small></div>
          </div>
          <a className="sidebar-help" href="https://docs.monad.xyz/" target="_blank" rel="noreferrer">
            <LifeBuoy size={16} /><span>Help & resources</span><ArrowUpRight size={13} />
          </a>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <div className="mobile-brand"><SiteLogo href="/app" /></div>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-sep">/</span><strong>{navigation.find((item) => item.href === pathname || (item.href !== "/app" && pathname.startsWith(item.href)))?.label ?? "Loan details"}</strong></div>
          <div className="topbar-actions">
            <span className="network-tag"><span className="network-indicator" /> Monad testnet</span>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </header>
        <div className="mobile-nav">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = href === "/app" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? "mobile-nav-link active" : "mobile-nav-link"}><Icon size={16} /><span>{label}</span></Link>;
          })}
        </div>
        <main className="app-content">{children}</main>
        <footer className="app-footer"><span>Built on Monad</span><span>Credit decisions are estimates from observable wallet history.</span></footer>
      </div>
    </div>
  );
}
