"use client";
import Link from "next/link";
import WalletButton from "./WalletButton";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#08090f]/80 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2 font-bold text-lg">
        <span className="text-xl">🔒</span>
        <span className="gradient-text">VestFlow</span>
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
        <Link href="/app" className="hover:text-white transition-colors">Dashboard</Link>
        <Link href="/app/create" className="hover:text-white transition-colors">New Schedule</Link>
        <a href="https://github.com/libby-coder/vestflow" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
        <a href="https://github.com/libby-coder/vestflow/issues" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contribute</a>
      </div>
      <WalletButton />
    </nav>
  );
}
