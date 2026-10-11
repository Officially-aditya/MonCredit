import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MonCredit — Your Web3 history is worth something",
  description: "Borrow, lend, and guarantee responsibly with transparent onchain history on Monad.",
  icons: { icon: "/brand/moncredit-icon-full-color.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
