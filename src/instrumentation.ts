import { wrapAISDK } from "braintrust";
import * as ai from "ai";

// Next.js calls register() on server startup when instrumentationHook is enabled.
// Wraps the Vercel AI SDK so every streamText / generateText call
// is automatically traced to Braintrust (when BRAINTRUST_API_KEY is set).
export function register() {
  wrapAISDK(ai);
}
