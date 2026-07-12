import type { Metadata } from "next";
import { Geist_Mono, TikTok_Sans } from "next/font/google";
import { WalletContextProvider } from "@/components/wallet/WalletContextProvider";
import "./globals.css";

// v3 noir type: TikTok Sans everywhere (300 for big numbers, 400-600 UI).
const tiktokSans = TikTok_Sans({
  variable: "--font-tiktok",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TrueBook",
    template: "%s | TrueBook",
  },
  description:
    "The sportsbook that cannot lie about its prices. Every quote is a TxLINE consensus price plus a displayed margin, auditable on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${tiktokSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
