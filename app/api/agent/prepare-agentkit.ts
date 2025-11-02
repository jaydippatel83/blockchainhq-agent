import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  NETWORK_ID_TO_VIEM_CHAIN,
  pythActionProvider,
  ViemWalletProvider,
  walletActionProvider,
  WalletProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import fs from "fs";
import { createWalletClient, Hex, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { x402ActionProvider } from "./x402-action-provider";

const WALLET_DATA_FILE = "wallet_data.txt";

export async function prepareAgentkitAndWalletProvider(): Promise<{
  agentkit: AgentKit;
  walletProvider: WalletProvider;
}> {
  try {
    let privateKey = process.env.PRIVATE_KEY as Hex;
    if (!privateKey) {
      if (fs.existsSync(WALLET_DATA_FILE)) {
        const walletData = JSON.parse(fs.readFileSync(WALLET_DATA_FILE, "utf8"));
        privateKey = walletData.privateKey as Hex;
        if (typeof privateKey === "string" && !privateKey.startsWith("0x")) {
          privateKey = `0x${privateKey}` as Hex;
        }
        console.info("Found private key in wallet_data.txt");
      } else {
        privateKey = generatePrivateKey();
        fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify({ privateKey }));
        console.log("Created new private key and saved to wallet_data.txt");
        console.log(
          "We recommend you save this private key to your .env file and delete wallet_data.txt afterwards.",
        );
      }
    } else {
      if (typeof privateKey === "string" && !privateKey.startsWith("0x")) {
        privateKey = `0x${privateKey}` as Hex;
      }
    }

    const account = privateKeyToAccount(privateKey);
    const networkId = process.env.NETWORK_ID as string;

    const client = createWalletClient({
      account,
      chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
      transport: http(),
    });
    const walletProvider = new ViemWalletProvider(client);

    const actionProviders: ActionProvider[] = [
      wethActionProvider(),
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
      x402ActionProvider(),
    ];
    const canUseCdpApi = process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET;
    if (canUseCdpApi) {
      actionProviders.push(
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_ID,
          apiKeyPrivateKey: process.env.CDP_API_KEY_SECRET,
        }),
      );
    }
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    return { agentkit, walletProvider };
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
