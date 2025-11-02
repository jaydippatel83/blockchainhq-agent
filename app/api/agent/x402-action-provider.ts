import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import { z } from "zod";
import "reflect-metadata";

const X402PaymentSchema = z.object({
  url: z.string().url().describe("The URL of the API endpoint that requires payment"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method for the request"),
  body: z.string().optional().describe("Optional request body for POST/PUT requests"),
  headers: z.record(z.string()).optional().describe("Optional custom headers for the request"),
});

const X402RequestSchema = z.object({
  url: z.string().url().describe("The URL of the x402-enabled API endpoint"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method for the request"),
  body: z.string().optional().describe("Optional request body for POST/PUT requests"),
  headers: z.record(z.string()).optional().describe("Optional custom headers for the request"),
});

export class X402ActionProvider extends ActionProvider<EvmWalletProvider> {
  private facilitatorBaseUrl: string;

  constructor() {
    super("x402_action_provider", []);
    this.facilitatorBaseUrl = process.env.X402_FACILITATOR_URL || "https://api.cdp.coinbase.com/x402/v1";
  }

  supportsNetwork = (network: Network): boolean => {
    const networkId = network.networkId;
    return networkId === "base-mainnet" || networkId === "base-sepolia";
  };

  // @ts-ignore
  @CreateAction({
    name: "x402_pay_for_api",
    description: `
Makes a payment request using the x402 payment protocol. This tool allows the agent to autonomously pay for API access or digital content using stablecoins (USDC on Base network).

The x402 protocol flow:
1. Makes an HTTP request to the target API endpoint
2. If payment is required, receives a 402 Payment Required response with payment instructions
3. Constructs and signs a payment transaction
4. Sends the payment via the x402 facilitator
5. Resubmits the original request with payment proof
6. Receives the requested resource after payment verification

Use this tool when:
- You need to access paid APIs that support x402
- The server responds with 402 Payment Required status code
- You want to make programmatic payments for API access

The payment will be made using USDC on the Base network. Ensure your wallet has sufficient USDC balance.

Learn more: https://docs.cdp.coinbase.com/x402/welcome
    `,
    schema: X402PaymentSchema,
  })
  public async payForApi(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof X402PaymentSchema>,
  ): Promise<string> {
    try {
      const { url, method = "GET", body, headers = {} } = args;

      const initialResponse = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body,
      });

      if (initialResponse.status === 402) {
        const paymentInfo = await initialResponse.json();
        
        const { amount, recipient, token, facilitator } = paymentInfo;
        
        const network = walletProvider.getNetwork();
        if (!this.supportsNetwork(network)) {
          return `Error: x402 payments are currently only supported on Base network (base-mainnet or base-sepolia). Current network: ${network.networkId}`;
        }

        try {
          const usdcContract = network.networkId === "base-mainnet" 
            ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
            : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
          
          const paymentTx = await walletProvider.sendTransaction({
            to: (token || usdcContract) as `0x${string}`,
            value: BigInt(0),
            data: this.encodeERC20Transfer(recipient, amount),
          });

          const receipt = await walletProvider.waitForTransactionReceipt(paymentTx);
          
          const paymentProof = {
            transactionHash: paymentTx,
            facilitator: facilitator || this.facilitatorBaseUrl,
          };

          const finalResponse = await fetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
              "X-402-Payment-Proof": JSON.stringify(paymentProof),
              ...headers,
            },
            body: body,
          });

          if (finalResponse.ok) {
            const responseData = await finalResponse.text();
            return `✅ Payment successful! Transaction: ${paymentTx}\nResponse: ${responseData}`;
          } else {
            return `⚠️ Payment sent but request failed. Transaction: ${paymentTx}\nStatus: ${finalResponse.status}\nResponse: ${await finalResponse.text()}`;
          }
        } catch (paymentError) {
          return `❌ Payment failed: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`;
        }
      } else if (initialResponse.ok) {
        const responseData = await initialResponse.text();
        return `✅ Request successful (no payment required):\n${responseData}`;
      } else {
        return `❌ Request failed with status ${initialResponse.status}: ${await initialResponse.text()}`;
      }
    } catch (error) {
      return `❌ Error making x402 request: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // @ts-ignore
  @CreateAction({
    name: "x402_request",
    description: `
Makes an HTTP request to an x402-enabled API endpoint. If payment is required (HTTP 402), 
this tool will automatically handle the payment flow and retry the request.

Use this when you want to access APIs that may require payment using the x402 protocol.
The agent will automatically pay if a 402 response is received.

Learn more: https://docs.cdp.coinbase.com/x402/welcome
    `,
    schema: X402RequestSchema,
  })
  public async request(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof X402RequestSchema>,
  ): Promise<string> {
    return this.payForApi(walletProvider, args);
  }

  private encodeERC20Transfer(to: string, amount: string): `0x${string}` {
    const transferSignature = "0xa9059cbb";
    const paddedAddress = to.slice(2).padStart(64, "0");
    const amountBigInt = BigInt(amount);
    const paddedAmount = amountBigInt.toString(16).padStart(64, "0");
    
    return `${transferSignature}${paddedAddress}${paddedAmount}` as `0x${string}`;
  }
}

export const x402ActionProvider = () => new X402ActionProvider();

