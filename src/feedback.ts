import type { Identity } from "agentback";
import { API_CONFIG } from "./config.js";
import { log } from "./utils.js";

/**
 * Look up the signed Agentback identity of the Search1API user behind
 * `apiKey`, so their feedback shows up under their account. Returns undefined
 * when there is no key or the lookup fails; the report is then sent without an
 * account rather than not at all.
 */
export async function feedbackIdentity(
  apiKey: string | undefined
): Promise<Identity | undefined> {
  if (!apiKey) return undefined;
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/feedback/identity`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!response.ok) {
      log(`Feedback identity lookup returned HTTP ${response.status}`);
      return undefined;
    }
    const body = (await response.json()) as Partial<Identity>;
    return typeof body.account === "string" &&
      typeof body.signature === "string"
      ? { account: body.account, signature: body.signature }
      : undefined;
  } catch {
    log("Feedback identity lookup failed");
    return undefined;
  }
}
