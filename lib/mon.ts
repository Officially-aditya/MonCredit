import { formatUnits, parseUnits } from "viem";

export const MON_DECIMALS = 18;

export function formatMon(amount: bigint, maximumFractionDigits = 4) {
  return Number(formatUnits(amount, MON_DECIMALS)).toLocaleString("en-US", { maximumFractionDigits });
}

export function parseMon(amount: string) {
  return parseUnits(amount, MON_DECIMALS);
}
