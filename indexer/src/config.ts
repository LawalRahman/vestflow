export type NetworkName = "mainnet" | "testnet";

export interface NetworkConfig {
  network: NetworkName;
  rpcUrl: string;
  contractId: string;
}

const DEFAULT_CONTRACT_IDS: Record<NetworkName, string> = {
  testnet: "CCZ6AE75C27DMB3SOIHK7WZSBUG3NQPVLHSVEBQ2FSAEVGRJ5TXAZWCX",
  mainnet: "",
};

const DEFAULT_RPC_URLS: Record<NetworkName, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

export function parseNetwork(value: string | null | undefined): NetworkName {
  if (value == null || value === "") return "testnet";
  if (value === "mainnet" || value === "testnet") return value;
  throw new Error(`Unsupported network: ${value}`);
}

export function getNetworkConfig(network = parseNetwork(process.env.INDEXER_NETWORK)): NetworkConfig {
  const upper = network.toUpperCase();
  return {
    network,
    rpcUrl:
      process.env[`RPC_URL_${upper}`] ??
      process.env.RPC_URL ??
      DEFAULT_RPC_URLS[network],
    contractId:
      process.env[`CONTRACT_ID_${upper}`] ??
      process.env.CONTRACT_ID ??
      DEFAULT_CONTRACT_IDS[network],
  };
}
