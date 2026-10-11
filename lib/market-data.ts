import type { PublicClient } from "viem";
import { creditMarketAbi, creditMarketAddress, type LoanRecord, loanStatusNames } from "@/lib/market";

export async function fetchLoans(client: PublicClient | undefined, maximum = 50): Promise<LoanRecord[]> {
  const marketAddress = creditMarketAddress;
  if (!client || !marketAddress) return [];
  try {
    const count = await client.readContract({
      address: marketAddress,
      abi: creditMarketAbi,
      functionName: "loanCount",
    });
    const start = count > BigInt(maximum) ? count - BigInt(maximum) + 1n : 1n;
    const ids: bigint[] = [];
    for (let id = count; id >= start && id > 0n; id -= 1n) ids.push(id);
    const summaries = await Promise.all(
      ids.map((id) =>
        client.readContract({
          address: marketAddress,
          abi: creditMarketAbi,
          functionName: "getLoanSummary",
          args: [id],
        }),
      ),
    );
    const eligibilitySummaries = await Promise.all(
      ids.map((id) =>
        client.readContract({
          address: marketAddress,
          abi: creditMarketAbi,
          functionName: "getEligibilitySummary",
          args: [id],
        }),
      ),
    );
    const guaranteeLists = await Promise.all(
      ids.map((id) =>
        client.readContract({
          address: marketAddress,
          abi: creditMarketAbi,
          functionName: "getGuarantors",
          args: [id],
        }),
      ),
    );
    return summaries.map((row, index) => ({
      id: ids[index].toString(),
      borrower: row[0],
      lender: row[1],
      principal: row[2],
      durationSeconds: Number(row[3]),
      guaranteeTotal: row[4],
      requiredGuarantee: row[5],
      requestDeadline: Number(row[6]),
      dueAt: Number(row[7]),
      interestBps: Number(row[8]),
      guaranteeBps: Number(row[9]),
      guarantorInterestBps: Number(row[10]),
      status: loanStatusNames[Number(row[11])] ?? "Open",
      historyHash: row[12],
      eligibilityScore: Number(eligibilitySummaries[index][0]),
      walletAgeDays: Number(eligibilitySummaries[index][1]),
      transactionCount: Number(eligibilitySummaries[index][2]),
      activeMonths: Number(eligibilitySummaries[index][3]),
      supportedAssetCount: Number(eligibilitySummaries[index][4]),
      guarantees: guaranteeLists[index][0].map((address, guaranteeIndex) => ({
        address,
        amount: guaranteeLists[index][1][guaranteeIndex],
      })),
    }));
  } catch {
    return [];
  }
}

export async function fetchLoan(client: PublicClient | undefined, id: bigint) {
  const marketAddress = creditMarketAddress;
  if (!client || !marketAddress) return null;
  try {
    const row = await client.readContract({
      address: marketAddress,
      abi: creditMarketAbi,
      functionName: "getLoanSummary",
      args: [id],
    });
    if (row[0] === "0x0000000000000000000000000000000000000000") return null;
    const historySummary = await client.readContract({
      address: marketAddress,
      abi: creditMarketAbi,
      functionName: "getEligibilitySummary",
      args: [id],
    });
    const [guarantorAddresses, guaranteeAmounts] = await client.readContract({
      address: marketAddress,
      abi: creditMarketAbi,
      functionName: "getGuarantors",
      args: [id],
    });
    return {
      id: id.toString(),
      borrower: row[0],
      lender: row[1],
      principal: row[2],
      durationSeconds: Number(row[3]),
      guaranteeTotal: row[4],
      requiredGuarantee: row[5],
      requestDeadline: Number(row[6]),
      dueAt: Number(row[7]),
      interestBps: Number(row[8]),
      guaranteeBps: Number(row[9]),
      guarantorInterestBps: Number(row[10]),
      status: loanStatusNames[Number(row[11])] ?? "Open",
      historyHash: row[12],
      eligibilityScore: Number(historySummary[0]),
      walletAgeDays: Number(historySummary[1]),
      transactionCount: Number(historySummary[2]),
      activeMonths: Number(historySummary[3]),
      supportedAssetCount: Number(historySummary[4]),
      guarantees: guarantorAddresses.map((address, index) => ({
        address,
        amount: guaranteeAmounts[index],
      })),
    } satisfies LoanRecord;
  } catch {
    return null;
  }
}
