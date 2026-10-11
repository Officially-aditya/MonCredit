# MonCredit

MonCredit is a testnet lending prototype for Monad Metropolis Track 1. It uses Ethereum wallet activity as one transparent input to an eligibility estimate, then settles loans in mock USDC on Monad testnet.

Borrowers can request a loan, guarantors can lock part of the required collateral, and one lender funds the request after the guarantee target is met. Repayment returns collateral and distributes interest automatically. If a loan defaults, locked collateral is paid to the lender and the remaining principal loss stays with the lender.

## Stack

- Next.js App Router, TypeScript, and CSS
- wagmi, viem, and RainbowKit
- Solidity 0.8.26, Foundry, and OpenZeppelin Contracts
- Monad testnet, chain ID 10143
- Ethereum mainnet history through Alchemy-compatible alchemy_getAssetTransfers

## Local setup

1. Install Node.js 20 or newer, npm, and Foundry.
2. Install JavaScript packages with: npm install
3. Copy .env.example to .env.local.
4. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID from WalletConnect, an Alchemy Ethereum mainnet URL in ETHEREUM_RPC_URL, and optionally your own public Monad RPC in NEXT_PUBLIC_MONAD_RPC_URL.
5. Create a dedicated eligibility signing key. Keep it only in the server environment; never prefix it with NEXT_PUBLIC_.
6. Deploy the test token and lending market as described below, then set both contract addresses in .env.local.
7. Run npm run dev and open http://localhost:3000.

The history API needs an Ethereum endpoint that supports alchemy_getAssetTransfers and historical eth_call requests. It reads no private key from a user's wallet and never asks for token approval during verification.

## Deploy to Monad testnet

Use a funded testnet deployer and set PRIVATE_KEY, ELIGIBILITY_SIGNER_PRIVATE_KEY, and MONAD_RPC_URL in your shell. The eligibility key must be the same signer configured in the Vercel server environment.

    forge build
    forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet-rpc.monad.xyz --broadcast

The deployment script emits ContractsDeployed with the MockUSDC address, CreditMarket address, and eligibility signer. Set the token and market addresses in .env.local:

    NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
    NEXT_PUBLIC_CREDIT_MARKET_ADDRESS=0x...
    CREDIT_MARKET_ADDRESS=0x...

Current Monad Testnet deployment (chain ID 10143):

- MockUSDC: [0xa719118698f0E139fF284Ee4fBd3c58251e2dfB4](https://repo.sourcify.dev/10143/0xa719118698f0E139fF284Ee4fBd3c58251e2dfB4/)
- CreditMarket: [0x70d134bcf970528986017d4281BC5eE6c22f2864](https://repo.sourcify.dev/10143/0x70d134bcf970528986017d4281BC5eE6c22f2864/)
- Eligibility signer: `0x45605364786BC8Aa885C354D96446e0d37069523`

The mock token has a one-time 1,000 mUSDC faucet for each test wallet. Wallets also need test MON for gas. Do not deploy the mock token as a production stablecoin.

## Tests and build

    forge test -vv
    npm run typecheck
    npm run build

The Foundry suite covers the 100 USDC / 30-day / 10% example, two 25 USDC guarantees, automatic repayment distribution, default collateral recovery, cancellation refunds, full-coverage funding, and authorization replay protection.

## History assessment

The server checks the user's Ethereum signature against a message that binds the Ethereum address and Monad borrowing address. It reads observed external/internal transactions and ERC-20/NFT transfers; scores wallet age, transaction activity, active months, supported USDC/DAI/WETH history, and MonCredit repayment/default records. It samples historical balances at up to three observed activity blocks where the RPC supports archive reads. The signed age, activity count, active months, supported-asset count, and score are stored with each loan so lenders can inspect the request-time history summary onchain.

The score is deterministic under moncredit-v1 and its component values are shown in the app. It is a limited estimate of observable activity, not proof of creditworthiness or a repayment promise. The signature-based authorization expires after 24 hours, includes the current onchain nonce, is tied to the market contract and chain ID, and can be consumed only once.

## Vercel configuration

Add these in Vercel project settings:

| Variable | Exposure | Purpose |
| --- | --- | --- |
| NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID | Browser | WalletConnect support |
| NEXT_PUBLIC_MONAD_RPC_URL | Browser | Monad testnet RPC for wallet reads |
| NEXT_PUBLIC_CREDIT_MARKET_ADDRESS | Browser | Monad CreditMarket reads and transactions |
| NEXT_PUBLIC_MOCK_USDC_ADDRESS | Browser | Test USDC reads and approvals |
| CREDIT_MARKET_ADDRESS | Server | Contract address used to read nonces and repayment history |
| ETHEREUM_RPC_URL | Server | Alchemy-compatible Ethereum mainnet RPC |
| MONAD_RPC_URL | Server | Monad testnet JSON-RPC, defaults to the public endpoint |
| ELIGIBILITY_SIGNER_PRIVATE_KEY | Server secret | Signs short-lived eligibility authorizations |

Set the same server variables in preview and production environments only after deploying the matching contracts. Keep the eligibility signer key in Vercel's encrypted environment settings and rotate it onchain with setEligibilitySigner if it must change.

## Demo flow

1. Connect an EVM wallet and claim its one-time 1,000 mUSDC test allocation.
2. On Proof of wealth, enter an Ethereum wallet and sign the ownership message.
3. Review the history facts, score components, balance samples, and estimated limit.
4. On Borrow, request up to the signed limit. Adjust the term, flat interest, guarantee coverage, and guarantor share. The default example is 100 mUSDC for 30 days at 10% flat interest, with 50% guarantee coverage and 40% of interest shared with guarantors.
5. Share the loan detail link. Guarantors approve and commit mUSDC; a lender funds once coverage is complete.
6. The borrower approves and repays principal plus interest. The contract sends the lender's share and returns guarantee collateral plus its interest share.
7. If repayment is missed, anyone can settle after the due time. The contract applies guarantee collateral to the lender's loss.

## Scope and limitations

- Only one lender and at most 16 guarantors are supported per loan.
- The first version recognizes mainnet USDC, DAI, and WETH for sampled historical balance reads.
- The history provider response is capped at 10,000 transfer records per direction per verification.
- Production deployments should use a private archive RPC, provider quotas, and rate limits on the verification API.
- All lending in the demo uses mUSDC on Monad testnet. No testnet balance or score represents real-world credit or monetary value.
