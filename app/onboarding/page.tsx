"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isConnected } from "@stellar/freighter-api";
import Navbar from "@/components/Navbar";
import { connectWallet } from "@/lib/stellar";
import { useWallet } from "@/lib/WalletContext";

const TOTAL_STEPS = 4;

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i < step ? "bg-violet-500" : "bg-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { publicKey, setPublicKey } = useWallet();
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = detecting, 1-4 = steps
  const [err, setErr] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [checkingFreighter, setCheckingFreighter] = useState(false);

  useEffect(() => {
    // Already connected — skip to the concept step
    if (publicKey) {
      setStep(3);
      return;
    }
    // Check if Freighter extension is installed
    isConnected()
      .then(installed => {
        setStep(installed ? 2 : 1);
      })
      .catch(() => setStep(1));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkFreighterInstalled = async () => {
    setCheckingFreighter(true);
    setErr("");
    try {
      const installed = await isConnected();
      if (installed) {
        setStep(2);
      } else {
        setErr("Freighter not detected. Please install it and refresh the page.");
      }
    } catch {
      setErr("Could not detect Freighter. Try refreshing the page.");
    } finally {
      setCheckingFreighter(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setErr("");
    try {
      const addr = await connectWallet();
      setPublicKey(addr);
      setStep(3);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem("vestflow-onboarding", "done");
    } catch {
      // localStorage may be unavailable; continue anyway
    }
    router.push("/app");
  };

  // Detecting initial state — show nothing briefly
  if (step === 0) return null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 pt-24 pb-20">
        <div className="w-full max-w-md card p-8 flex flex-col">
          <ProgressDots step={step} />

          {/* Step 1 — Install Freighter */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-4xl mb-4">🔐</p>
                <h1 className="text-2xl font-bold mb-2">First, install Freighter</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Freighter is a browser extension wallet for the Stellar network.
                  You'll need it to sign transactions on VestFlow.
                </p>
              </div>

              {err && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                  {err}
                </p>
              )}

              <a
                href="https://www.freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary rounded-xl py-3 font-semibold text-white text-center text-sm"
              >
                Get Freighter →
              </a>
              <button
                onClick={checkFreighterInstalled}
                disabled={checkingFreighter}
                className="rounded-xl py-3 border border-white/10 text-zinc-400 hover:text-white transition-colors text-sm font-semibold disabled:opacity-40"
              >
                {checkingFreighter ? "Checking…" : "I've installed it →"}
              </button>
            </div>
          )}

          {/* Step 2 — Connect Wallet */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-4xl mb-4">🔗</p>
                <h1 className="text-2xl font-bold mb-2">Connect your wallet</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Allow VestFlow to read your Stellar address. You'll approve each
                  transaction individually — we never have access to your keys.
                </p>
              </div>

              {err && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                  {err}
                </p>
              )}

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="btn-primary rounded-xl py-3 font-semibold text-white text-sm disabled:opacity-60"
              >
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            </div>
          )}

          {/* Step 3 — How vesting works */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-4xl mb-4">📈</p>
                <h1 className="text-2xl font-bold mb-2">How token vesting works</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Vesting gradually releases tokens to a recipient over time —
                  no middleman required.
                </p>
              </div>

              <ul className="flex flex-col gap-3 text-sm text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="text-violet-400 mt-0.5">●</span>
                  <span><strong className="text-white">Linear vesting</strong> — tokens unlock continuously from start to end date.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-violet-400 mt-0.5">●</span>
                  <span><strong className="text-white">Cliff period</strong> — no tokens are available until the cliff date is reached.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-violet-400 mt-0.5">●</span>
                  <span><strong className="text-white">Revocable schedules</strong> — the creator can cancel early; unvested tokens return to them.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-violet-400 mt-0.5">●</span>
                  <span><strong className="text-white">Claim any time</strong> — recipients can claim vested tokens whenever they like.</span>
                </li>
              </ul>

              <button
                onClick={() => setStep(4)}
                className="btn-primary rounded-xl py-3 font-semibold text-white text-sm"
              >
                Got it →
              </button>
            </div>
          )}

          {/* Step 4 — Ready */}
          {step === 4 && (
            <div className="flex flex-col gap-5 text-center">
              <div>
                <p className="text-4xl mb-4">🎉</p>
                <h1 className="text-2xl font-bold mb-2">You're all set!</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Head to your dashboard to create your first vesting schedule
                  or view existing ones.
                </p>
              </div>

              <button
                onClick={handleFinish}
                className="btn-primary rounded-xl py-3 font-semibold text-white text-sm"
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
