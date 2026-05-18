"use client";
import { createContext, useContext, useState, ReactNode } from "react";

interface WalletCtx { publicKey: string | null; setPublicKey: (k: string | null) => void; }
const WalletContext = createContext<WalletCtx>({ publicKey: null, setPublicKey: () => {} });

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  return <WalletContext.Provider value={{ publicKey, setPublicKey }}>{children}</WalletContext.Provider>;
}

export function useWallet() { return useContext(WalletContext); }
