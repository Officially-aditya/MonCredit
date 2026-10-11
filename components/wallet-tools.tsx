"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Droplets, LoaderCircle } from "lucide-react";
import { formatUnits, type Hex } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { creditMarketAddress, mockUsdcAbi, mockUsdcAddress } from "@/lib/market";

export function WalletTools() {
  const { address } = useAccount();
  const balance = useReadContract({
    address: mockUsdcAddress,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && mockUsdcAddress) },
  });
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const [claimError, setClaimError] = useState("");
  const receipt = useWaitForTransactionReceipt({ hash: hash as Hex | undefined });

  useEffect(() => {
    if (receipt.isSuccess) void balance.refetch();
  }, [receipt.isSuccess]);

  async function claim() {
    setClaimError("");
    if (!mockUsdcAddress) {
      setClaimError("Mock USDC address is not configured.");
      return;
    }
    try {
      await writeContractAsync({
        address: mockUsdcAddress,
        abi: mockUsdcAbi,
        functionName: "claimFaucet",
      });
    } catch (cause) {
      setClaimError(cause instanceof Error ? cause.message : "Faucet claim failed.");
    }
  }

  if (!address) return <div className="wallet-tools-note">Connect your wallet to see balances and manage test funds.</div>;
  return (
    <div className="wallet-tools">
      <div className="wallet-balance">
        <span className="balance-icon"><Droplets size={16} /></span>
        <div><span>Test token balance</span><strong>{balance.data === undefined ? "—" : Number(formatUnits(balance.data, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " mUSDC"}</strong></div>
      </div>
      <button className="button button-secondary button-small" onClick={claim} disabled={isPending || receipt.isLoading || !mockUsdcAddress}>
        {isPending || receipt.isLoading ? <LoaderCircle className="spin" size={15} /> : receipt.isSuccess ? <Check size={15} /> : <Droplets size={15} />}
        {receipt.isSuccess ? "Claimed" : "Get test mUSDC"}
        {!isPending && !receipt.isLoading && !receipt.isSuccess && <ChevronRight size={14} />}
      </button>
      {(!creditMarketAddress || !mockUsdcAddress) && <p className="small-note">Add deployed contract addresses to .env.local to enable transactions.</p>}
      {(claimError || error) && <p className="action-error">{claimError || (error && "shortMessage" in error ? String(error.shortMessage) : error?.message)}</p>}
      {hash && receipt.isSuccess && <a className="tx-link" href={"https://testnet.monadexplorer.com/tx/" + hash} target="_blank" rel="noreferrer">View faucet transaction</a>}
    </div>
  );
}
