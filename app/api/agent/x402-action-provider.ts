import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import { z } from "zod";
import "reflect-metadata";

/**
 * Schema for x402 payment action
 */
const X402PaymentSchema = z.object({
  url: z.string().url().describe("The URL of the API endpoint that requires payment"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method for the request"),
  body: z.string().optional().describe("Optional request body for POST/PUT requests"),
  headers: z.record(z.string()).optional().describe("Optional custom headers for the request"),
});

/**
 * Schema for making x402 API requests
 */
const X402RequestSchema = z.object({
  url: z.string().url().describe("The URL of the x402-enabled API endpoint"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method for the request"),
  body: z.string().optional().describe("Optional request body for POST/PUT requests"),
  headers: z.record(z.string()).optional().describe("Optional custom headers for the request"),
});

/**
 * X402ActionProvider enables AI agents to make autonomous payments using the x402 protocol.
 * 
 * x402 is an open payment protocol that enables instant, automatic stablecoin payments
 * directly over HTTP using the HTTP 402 Payment Required status code.
 * 
 * Learn more: https://docs.cdp.coinbase.com/x402/welcome
 */
export class X402ActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Base URL for the x402 facilitator (CDP's facilitator)
   */
  private facilitatorBaseUrl: string;

  constructor() {
    super("x402_action_provider", []);
    // CDP's x402 facilitator - using Base network by default
    this.facilitatorBaseUrl = process.env.X402_FACILITATOR_URL || "https://api.cdp.coinbase.com/x402/v1";
  }

  /**
   * Checks if the x402 action provider supports the given network.
   * Currently supports Base network (mainnet and sepolia testnet).
   */
  supportsNetwork = (network: Network): boolean => {
    const networkId = network.networkId;
    // x402 facilitator currently supports Base network
    return networkId === "base-mainnet" || networkId === "base-sepolia";
  };

  /**
   * Makes a payment request using the x402 protocol.
   * This action handles the complete x402 payment flow:
   * 1. Makes initial HTTP request
   * 2. Handles 402 Payment Required response
   * 3. Constructs and signs payment transaction
   * 4. Sends payment via facilitator
   * 5. Resubmits request with payment proof
   * 
   * @param walletProvider - The wallet provider to use for signing transactions
   * @param args - Payment request arguments
   * @returns A string describing the payment result and response
   */
  // @ts-ignore - AgentKit decorator type definition issue with experimental decorators
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

      // Step 1: Make initial request
      const initialResponse = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body,
      });

      // Step 2: Check if payment is required
      if (initialResponse.status === 402) {
        const paymentInfo = await initialResponse.json();
        
        // Extract payment instructions from 402 response
        const { amount, recipient, token, facilitator } = paymentInfo;
        
        // Validate we're on a supported network
        const network = walletProvider.getNetwork();
        if (!this.supportsNetwork(network)) {
          return `Error: x402 payments are currently only supported on Base network (base-mainnet or base-sepolia). Current network: ${network.networkId}`;
        }

        // Step 3: Construct and send payment
        try {
          // For USDC payments, we need to send the transaction to the USDC token contract
          // The recipient is where the payment goes, but the transaction target is the token contract
          // Base network USDC contract address (adjust for testnet/mainnet)
          const usdcContract = network.networkId === "base-mainnet" 
            ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base Mainnet USDC
            : "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
          
          // Construct payment transaction to USDC contract with transfer call
          // Note: In production, you should use the x402 facilitator API which handles
          // payment construction, verification, and settlement more securely.
          const paymentTx = await walletProvider.sendTransaction({
            to: (token || usdcContract) as `0x${string}`, // Token contract address
            value: BigInt(0), // USDC is an ERC20 token, so value is 0
            data: this.encodeERC20Transfer(recipient, amount), // Encode ERC20 transfer to recipient
          });

          // Step 4: Wait for transaction confirmation
          const receipt = await walletProvider.waitForTransactionReceipt(paymentTx);
          
          // Step 5: Resubmit request with payment proof
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
        // No payment required
        const responseData = await initialResponse.text();
        return `✅ Request successful (no payment required):\n${responseData}`;
      } else {
        // Other error
        return `❌ Request failed with status ${initialResponse.status}: ${await initialResponse.text()}`;
      }
    } catch (error) {
      return `❌ Error making x402 request: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Makes an HTTP request to an x402-enabled endpoint, automatically handling payments if required.
   * 
   * @param walletProvider - The wallet provider to use for signing transactions
   * @param args - Request arguments
   * @returns The API response after payment (if required)
   */
  // @ts-ignore - AgentKit decorator type definition issue with experimental decorators
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
    // Delegate to payForApi since it handles the full flow
    return this.payForApi(walletProvider, args);
  }

  /**
   * Encodes an ERC20 transfer call (for USDC payments)
   * Method: transfer(address to, uint256 amount)
   */
  private encodeERC20Transfer(to: string, amount: string): `0x${string}` {
    // ERC20 transfer function signature: transfer(address,uint256)
    const transferSignature = "0xa9059cbb";
    // Pad address to 32 bytes
    const paddedAddress = to.slice(2).padStart(64, "0");
    // Convert amount to hex and pad to 32 bytes
    const amountBigInt = BigInt(amount);
    const paddedAmount = amountBigInt.toString(16).padStart(64, "0");
    
    return `${transferSignature}${paddedAddress}${paddedAmount}` as `0x${string}`;
  }
}

/**
 * Factory function to create a new X402ActionProvider instance.
 * 
 * @returns A new X402ActionProvider instance.
 */
export const x402ActionProvider = () => new X402ActionProvider();

