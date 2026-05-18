"use client";
import { useState } from "react";
import { connectWallet, truncate } from "@/lib/stellar";
import { useWallet } from "@/lib/WalletContext";

export default function WalletButton() {
  const { publicKey, setPublicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const connect = async () => {
    setLoading(true); setErr("");
    try { setPublicKey(await connectWallet()); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  if (publicKey) return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-zinc-300">{truncate(publicKey)}</span>
      <button onClick={() => setPublicKey(null)} className="text-xs text-zinc-500 hover:text-white transition-colors">Disconnect</button>
    </div>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={connect} disabled={loading} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Connecting…" : "Connect Wallet"}
      </button>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
