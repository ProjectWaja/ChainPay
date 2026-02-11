import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import NavSidebar from "@/components/NavSidebar";
import { ConnectButton } from "@/components/ConnectButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChainPay — Cross-Chain Payroll Dashboard",
  description: "Automated cross-chain payroll powered by Chainlink",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100`}>
        <WalletProvider>
          <div className="flex flex-col min-h-screen">
            {/* Top bar */}
            <header className="h-14 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">C</div>
                <span className="text-lg font-semibold text-white">ChainPay</span>
              </div>
              <ConnectButton />
            </header>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              <NavSidebar />
              <main className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
