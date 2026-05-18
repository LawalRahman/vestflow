import type { Metadata } from "next";
import { WalletProvider } from "@/lib/WalletContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "VestFlow — Token Vesting on Stellar",
  description: "Create and manage token vesting schedules on the Stellar network using Soroban smart contracts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#08090f] text-white antialiased" style={{ fontFamily: "system-ui, sans-serif" }}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
