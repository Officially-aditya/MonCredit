import { getAddress, isAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ethereumAddress?: string;
      borrowingAddress?: string;
    };
    if (!body.ethereumAddress || !isAddress(body.ethereumAddress)) {
      return NextResponse.json({ error: "Enter a valid Ethereum address." }, { status: 400 });
    }
    if (!body.borrowingAddress || !isAddress(body.borrowingAddress)) {
      return NextResponse.json({ error: "Connect the Monad wallet that will borrow." }, { status: 400 });
    }

    const issuedAt = new Date().toISOString();
    const nonce = crypto.randomUUID();
    const challenge = [
      "MonCredit historical wallet verification",
      "Ethereum wallet: " + getAddress(body.ethereumAddress),
      "Monad borrowing wallet: " + getAddress(body.borrowingAddress),
      "Issued at: " + issuedAt,
      "Nonce: " + nonce,
      "This signature proves wallet ownership. It does not authorize a token transfer.",
    ].join("\n");

    return NextResponse.json({ challenge, issuedAt, nonce });
  } catch {
    return NextResponse.json({ error: "Could not create a verification challenge." }, { status: 400 });
  }
}
