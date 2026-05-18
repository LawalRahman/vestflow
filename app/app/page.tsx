"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ScheduleCard from "@/components/ScheduleCard";
import { getAllSchedules, ScheduleData } from "@/lib/stellar";
import { useWallet } from "@/lib/WalletContext";
import Link from "next/link";

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await getAllSchedules();
      if (publicKey) {
        setSchedules(all.filter(s => s.grantor === publicKey || s.beneficiary === publicKey));
      } else {
        setSchedules(all.slice(0, 6));
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [publicKey]);

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 pt-28 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-zinc-400 mt-1">Your active vesting schedules</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} disabled={loading} className="text-sm text-zinc-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition-colors disabled:opacity-40">
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
            <Link href="/app/create" className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white">
              + New Schedule
            </Link>
          </div>
        </div>

        {loading && schedules.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1,2,3,4].map(i => <div key={i} className="h-56 rounded-2xl bg-white/3 animate-pulse" />)}
          </div>
        ) : schedules.length === 0 ? (
          <div className="card p-16 text-center">
            <p className="text-4xl mb-4">🔒</p>
            <p className="text-zinc-400">{publicKey ? "No vesting schedules found for your wallet." : "Connect your wallet to see your schedules."}</p>
            <Link href="/app/create" className="inline-block mt-5 btn-primary rounded-lg px-5 py-2.5 text-sm font-semibold text-white">
              Create Your First Schedule
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {schedules.map(s => <ScheduleCard key={s.id} schedule={s} onAction={load} />)}
          </div>
        )}
      </main>
    </>
  );
}
