"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { fetchLoans } from "@/lib/market-data";
import type { LoanRecord } from "@/lib/market";

export function useMarketLoans() {
  const client = usePublicClient();
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchLoans(client);
    setLoans(result);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { loans, loading, refresh };
}
