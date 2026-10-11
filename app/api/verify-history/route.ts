import { NextResponse } from "next/server";
import {
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  formatUnits,
  getAddress,
  http,
  isAddress,
  isHex,
  keccak256,
  recoverMessageAddress,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "@/lib/chain";

export const runtime = "nodejs";
export const maxDuration = 60;

const marketAbi = [
  {
    type: "function",
    name: "eligibilityNonce",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "userCreditRecord",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [
      { name: "repaid", type: "uint256" },
      { name: "defaults", type: "uint256" },
      { name: "borrowed", type: "uint256" },
      { name: "repaidAmount", type: "uint256" },
    ],
  },
] as const;

const supportedTokens = [
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
] as const;

type Transfer = {
  uniqueId?: string;
  hash?: string;
  blockNum?: string;
  category?: string;
  asset?: string | null;
  rawContract?: { address?: string; value?: string; decimal?: number };
  metadata?: { blockTimestamp?: string };
  timestamp?: number;
};

type RpcResult<T> = { result?: T; error?: { message?: string } };

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("RPC request failed.");
  const payload = (await response.json()) as RpcResult<T>;
  if (payload.error || payload.result === undefined) throw new Error("RPC provider could not complete the request.");
  return payload.result;
}

async function loadTransfers(url: string, address: Address, direction: "fromAddress" | "toAddress") {
  const rows: Transfer[] = [];
  let pageKey: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const filter = {
      fromBlock: "0x0",
      toBlock: "latest",
      category: ["external", "internal", "erc20", "erc721", "erc1155"],
      [direction]: address,
      excludeZeroValue: false,
      withMetadata: true,
      order: "asc",
      maxCount: "0x3e8",
      ...(pageKey ? { pageKey } : {}),
    };
    const response = await rpc<{ transfers?: Transfer[]; pageKey?: string }>(
      url,
      "alchemy_getAssetTransfers",
      [filter],
    );
    rows.push(...(response.transfers ?? []));
    pageKey = response.pageKey;
    if (!pageKey) break;
  }
  return { rows, truncated: Boolean(pageKey) };
}

async function getBlockTimestamp(url: string, blockNum: string) {
  const block = await rpc<{ timestamp?: string }>(url, "eth_getBlockByNumber", [blockNum, false]);
  return block.timestamp ? Number(BigInt(block.timestamp)) * 1_000 : 0;
}

function toBlockTag(blockNum: string) {
  return "0x" + BigInt(blockNum).toString(16);
}

async function historicalBalanceSnapshots(url: string, address: Address, transfers: Transfer[]) {
  const sorted = transfers
    .filter((entry) => entry.blockNum)
    .sort((left, right) => Number(BigInt(left.blockNum!)) - Number(BigInt(right.blockNum!)));
  if (sorted.length === 0) return [];

  const distinctBlocks = sorted.filter((entry, index) => index === 0 || entry.blockNum !== sorted[index - 1].blockNum);
  const indexes = [...new Set([0, Math.floor((distinctBlocks.length - 1) / 2), distinctBlocks.length - 1])];
  const samples = indexes.map((index) => distinctBlocks[index]).filter(Boolean);
  const snapshots = [];
  for (const sample of samples) {
    try {
      const blockTag = toBlockTag(sample.blockNum!);
      const timestamp = sample.metadata?.blockTimestamp
        ? Date.parse(sample.metadata.blockTimestamp)
        : await getBlockTimestamp(url, blockTag);
      const nativeBalance = await rpc<string>(url, "eth_getBalance", [address, blockTag]);
      const tokens = await Promise.all(
        supportedTokens.map(async (token) => {
          const encodedAddress = address.toLowerCase().replace("0x", "").padStart(64, "0");
          const data = ("0x70a08231" + encodedAddress) as Hex;
          const raw = await rpc<string>(url, "eth_call", [{ to: token.address, data }, blockTag]);
          const value = raw === "0x" ? 0n : BigInt(raw);
          return { symbol: token.symbol, balance: formatUnits(value, token.decimals), rawBalance: value.toString() };
        }),
      );
      snapshots.push({
        blockNumber: Number(BigInt(sample.blockNum!)),
        timestamp,
        nativeEth: formatUnits(BigInt(nativeBalance), 18),
        tokens,
      });
    } catch {
      // Some public RPC endpoints prune old state. A missing snapshot is reported as unavailable.
    }
  }
  return snapshots;
}

function clamp(value: number, maximum: number) {
  return Math.max(0, Math.min(value, maximum));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ethereumAddress?: string;
      borrowingAddress?: string;
      signature?: string;
      challenge?: string;
      issuedAt?: string;
    };
    if (!body.ethereumAddress || !isAddress(body.ethereumAddress)) {
      return NextResponse.json({ error: "Enter a valid Ethereum address." }, { status: 400 });
    }
    if (!body.borrowingAddress || !isAddress(body.borrowingAddress)) {
      return NextResponse.json({ error: "Connect the Monad borrowing wallet first." }, { status: 400 });
    }
    if (!body.challenge || typeof body.challenge !== "string" || !body.signature || !isHex(body.signature)) {
      return NextResponse.json({ error: "Sign the wallet verification message to continue." }, { status: 400 });
    }
    const issuedAtMs = body.issuedAt ? Date.parse(body.issuedAt) : Number.NaN;
    if (!Number.isFinite(issuedAtMs) || Math.abs(Date.now() - issuedAtMs) > 10 * 60 * 1_000) {
      return NextResponse.json({ error: "That verification message expired. Create a new one." }, { status: 400 });
    }

    const ethereumAddress = getAddress(body.ethereumAddress);
    const borrowingAddress = getAddress(body.borrowingAddress);
    const challengeLines = body.challenge.split("\n");
    if (
      !challengeLines.includes("Ethereum wallet: " + ethereumAddress) ||
      !challengeLines.includes("Monad borrowing wallet: " + borrowingAddress) ||
      !challengeLines.includes("Issued at: " + body.issuedAt) ||
      !challengeLines.some((line) => line.startsWith("Nonce: "))
    ) {
      return NextResponse.json({ error: "The signed message does not match the wallet addresses or timestamp submitted." }, { status: 401 });
    }
    let recovered: Address;
    try {
      recovered = await recoverMessageAddress({
        message: body.challenge,
        signature: body.signature as Hex,
      });
    } catch {
      return NextResponse.json({ error: "The wallet signature could not be verified." }, { status: 401 });
    }
    if (recovered !== ethereumAddress) {
      return NextResponse.json({ error: "The signature does not belong to the Ethereum wallet entered." }, { status: 401 });
    }

    const ethereumRpc = process.env.ETHEREUM_RPC_URL;
    const signerKey = process.env.ELIGIBILITY_SIGNER_PRIVATE_KEY;
    const marketAddressValue = process.env.CREDIT_MARKET_ADDRESS ?? process.env.NEXT_PUBLIC_CREDIT_MARKET_ADDRESS;
    if (!ethereumRpc || !signerKey || !marketAddressValue || !isAddress(marketAddressValue)) {
      return NextResponse.json(
        { error: "History verification is not configured yet. Add the server RPC, signer key, and deployed market address." },
        { status: 503 },
      );
    }
    if (!isHex(signerKey, { strict: true }) || signerKey.length !== 66) {
      return NextResponse.json({ error: "The eligibility signer key is not a valid 32-byte private key." }, { status: 503 });
    }

    const [sentResult, receivedResult] = await Promise.all([
      loadTransfers(ethereumRpc, ethereumAddress, "fromAddress"),
      loadTransfers(ethereumRpc, ethereumAddress, "toAddress"),
    ]);
    const sent = sentResult.rows;
    const received = receivedResult.rows;
    const unique = new Map<string, Transfer>();
    for (const transfer of [...sent, ...received]) {
      const key = transfer.uniqueId ?? [transfer.hash, transfer.blockNum, transfer.rawContract?.address, transfer.rawContract?.value, transfer.category].join(":");
      unique.set(key, transfer);
    }
    const transfers = [...unique.values()].sort(
      (left, right) => Number(BigInt(left.blockNum ?? "0x0")) - Number(BigInt(right.blockNum ?? "0x0")),
    );
    if (transfers.length === 0) {
      return NextResponse.json(
        { error: "No Ethereum transaction or token-transfer history was found for this wallet." },
        { status: 422 },
      );
    }

    const hydrated = transfers.map((transfer) => ({
      ...transfer,
      timestamp: transfer.metadata?.blockTimestamp ? Date.parse(transfer.metadata.blockTimestamp) : 0,
    }));
    if (hydrated.length && !hydrated[0].timestamp && hydrated[0].blockNum) {
      hydrated[0].timestamp = await getBlockTimestamp(ethereumRpc, hydrated[0].blockNum).catch(() => 0);
    }
    const missingTimestamps = hydrated.filter((transfer) => !transfer.timestamp).length;
    const dated = hydrated.filter((transfer) => transfer.timestamp && transfer.timestamp > 0);
    const firstTimestamp = dated.length ? Math.min(...dated.map((transfer) => transfer.timestamp!)) : 0;
    const activeMonths = new Set(
      dated.map((transfer) => {
        const date = new Date(transfer.timestamp!);
        return date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1);
      }),
    );
    const tokenAddresses = new Set(
      transfers
        .filter((transfer) => transfer.category === "erc20" && transfer.rawContract?.address)
        .map((transfer) => transfer.rawContract!.address!.toLowerCase()),
    );
    const supportedAddresses = new Set(supportedTokens.map((token) => token.address.toLowerCase()));
    const supportedAssetActivity = [...tokenAddresses].filter((token) => supportedAddresses.has(token));
    const snapshots = await historicalBalanceSnapshots(ethereumRpc, ethereumAddress, transfers);
    const heldAssets = new Set(
      snapshots.flatMap((snapshot) =>
        snapshot.tokens.filter((token) => BigInt(token.rawBalance) > 0n).map((token) => token.symbol),
      ),
    );
    const walletAgeDays = firstTimestamp ? Math.floor((Date.now() - firstTimestamp) / 86_400_000) : 0;
    const transactionCount = new Set(transfers.map((transfer) => transfer.hash).filter(Boolean)).size;
    const historyTruncated = sentResult.truncated || receivedResult.truncated;

    const chain = defineChain({
      ...monadTestnet,
      rpcUrls: { default: { http: [process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz"] } },
    });
    const client = createPublicClient({ chain, transport: http() });
    const marketAddress = getAddress(marketAddressValue);
    const [nonce, creditRecord] = await Promise.all([
      client.readContract({
        address: marketAddress,
        abi: marketAbi,
        functionName: "eligibilityNonce",
        args: [borrowingAddress],
      }),
      client.readContract({
        address: marketAddress,
        abi: marketAbi,
        functionName: "userCreditRecord",
        args: [borrowingAddress],
      }),
    ]);
    const [repaidCount, defaultCount, totalBorrowed, totalRepaid] = creditRecord;

    const scoreParts = {
      walletAge: clamp(Math.floor(walletAgeDays / 90), 25),
      transactionActivity: clamp(Math.floor(transactionCount / 20), 25),
      activeMonths: clamp(activeMonths.size * 2, 25),
      supportedAssetHistory: clamp(supportedAssetActivity.length * 6 + heldAssets.size * 2, 25),
      repaymentBonus: clamp(Number(repaidCount) * 4, 20),
      defaultPenalty: clamp(Number(defaultCount) * 20, 40),
    };
    const score = clamp(
      scoreParts.walletAge +
        scoreParts.transactionActivity +
        scoreParts.activeMonths +
        scoreParts.supportedAssetHistory +
        scoreParts.repaymentBonus -
        scoreParts.defaultPenalty,
      100,
    );
    const maxLoanMon = score < 25 ? 0 : Math.max(0, Math.min(5_000, 100 + score * 10 - Number(defaultCount) * 100));
    const maxLoanAmount = BigInt(maxLoanMon) * 10n ** 18n;
    const eligibilityExpiry = BigInt(Math.floor(Date.now() / 1_000) + 24 * 60 * 60);
    const history = {
      ethereumAddress,
      borrowingAddress,
      walletAgeDays,
      transactionCount,
      activeMonths: activeMonths.size,
      supportedAssetActivity: supportedAssetActivity.length,
      historicalHoldings: snapshots,
      observedSupportedAssets: supportedTokens
        .filter((token) => supportedAssetActivity.includes(token.address.toLowerCase()))
        .map((token) => token.symbol),
      heldSupportedAssets: [...heldAssets],
      firstSeenAt: firstTimestamp ? new Date(firstTimestamp).toISOString() : null,
      creditRecord: {
        repaidCount: Number(repaidCount),
        defaultCount: Number(defaultCount),
        totalBorrowed: totalBorrowed.toString(),
        totalRepaid: totalRepaid.toString(),
      },
      scoreParts,
      score,
      methodologyVersion: "moncredit-v2-native-mon",
      historyTruncated,
    };
    const historyHash = keccak256(toHex(JSON.stringify(history)));
    const signer = privateKeyToAccount(signerKey as Hex);
    const payload = keccak256(
      encodeAbiParameters(
        [
          { type: "address" },
          { type: "uint256" },
          { type: "address" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "bytes32" },
          { type: "uint32" },
          { type: "uint32" },
          { type: "uint16" },
          { type: "uint8" },
        ],
        [
          marketAddress,
          BigInt(chain.id),
          borrowingAddress,
          maxLoanAmount,
          BigInt(score),
          nonce,
          eligibilityExpiry,
          historyHash,
          walletAgeDays,
          transactionCount,
          activeMonths.size,
          supportedAssetActivity.length,
        ],
      ),
    );
    const authorizationSignature = await signer.signMessage({ message: { raw: payload } });

    return NextResponse.json({
      ethereumAddress,
      borrowingAddress,
      score,
      scoreParts,
      maxLoanAmount: maxLoanAmount.toString(),
      maxLoanMon,
      nonce: nonce.toString(),
      eligibilityExpiry: eligibilityExpiry.toString(),
      historyHash,
      signature: authorizationSignature,
      history,
      warnings: [
        ...(snapshots.length === 0
          ? ["Historical token-balance snapshots were unavailable from this RPC. Activity and score use transfer history only."]
          : []),
        ...(historyTruncated ? ["The provider returned more than the 10,000-record per-direction cap; the score uses the first returned records."] : []),
        ...(missingTimestamps ? ["Some transfer dates were unavailable, so active-month scoring may omit those records."] : []),
      ],
    });
  } catch {
    console.error("History verification failed.");
    return NextResponse.json(
      { error: "Could not retrieve or verify Ethereum history. Check the RPC configuration and try again." },
      { status: 502 },
    );
  }
}
