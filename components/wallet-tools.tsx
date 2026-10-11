"use client";

import { Wallet } from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { formatMon } from "@/lib/mon";

export function WalletTools() {
  const { address } = useAccount();
  const balance = useBalance({ address, query: { enabled: Boolean(address) } });

  if (!address) return <div className="wallet-tools-note">Connect your wallet to see your MON balance.</div>;

  return (
    <div className="wallet-tools">
      <div className="wallet-balance">
        <span className="balance-icon"><Wallet size={16} /></span>
        <div>
          <span>Available MON</span>
          <strong>{balance.data ? formatMon(balance.data.value) + " MON" : balance.isLoading ? "Loading" : "Unavailable"}</strong>
        </div>
      </div>
      <p className="small-note">MON pays for both loan activity and network fees.</p>
    </div>
  );
}
