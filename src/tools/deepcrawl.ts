import {
  DeepcrawlPage,
  DeepcrawlStartResponse,
  DeepcrawlStatusResponse,
  isValidDeepcrawlArgs,
} from '../types.js';
import { ApiResponseError, makeGetRequest, makeRequest } from '../api.js';
import { formatError, log } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * How long one deepcrawl call waits for its task. A 20-page crawl usually
 * takes 10-20 s; anything slower is handed back as a task_id so the call
 * stays well inside common client timeouts. Mutable so tests can shorten it.
 */
export const DEEPCRAWL_POLLING = {
  intervalMs: 2_000,
  timeoutMs: 45_000,
};

/** Bounds on the page text returned inline; resultUrl holds the rest. */
export const DEEPCRAWL_TEXT_LIMITS = {
  perPage: 8_000,
  total: 80_000,
};

const RUNNING_STATUSES = new Set(["queued", "waiting", "processing", "running", "unknown"]);

type StatusCheck =
  | { kind: "status"; response: DeepcrawlStatusResponse }
  | { kind: "error"; error: unknown; retryable: boolean };

function errorResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

function toolResult(structuredContent: Record<string, unknown>): CallToolResult {
  return {
    structuredContent,
    content: [{
      type: "text",
      text: JSON.stringify(structuredContent)
    }]
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Read a task's status. A failed task arrives as HTTP 500 and an unknown one
 * as HTTP 404, both with a task payload, so those bodies are statuses too.
 */
async function checkStatus(taskId: string, apiKey?: string): Promise<StatusCheck> {
  try {
    const response = await makeGetRequest<DeepcrawlStatusResponse>(
      `${API_CONFIG.ENDPOINTS.DEEPCRAWL_STATUS}/${encodeURIComponent(taskId)}`,
      apiKey
    );
    return { kind: "status", response };
  } catch (error) {
    if (error instanceof ApiResponseError) {
      const body = error.body && typeof error.body === "object" ? error.body : {};
      if (error.status === 404) {
        return { kind: "status", response: { ...body, taskId, status: "not_found" } };
      }
      if (typeof body.status === "string" && body.taskId) {
        return { kind: "status", response: body };
      }
      // Rate limits and server faults can clear up while we wait; a rejected
      // credential or request will not.
      return { kind: "error", error, retryable: error.status === 429 || error.status >= 500 };
    }
    return { kind: "error", error, retryable: true };
  }
}

/** Cut at a UTF-16 boundary so a shortened text never ends in half a character. */
function cutText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  let cut = text.slice(0, limit);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) {
    cut = cut.slice(0, -1);
  }
  return cut;
}

function pagesToResults(pages: DeepcrawlPage[]) {
  let remaining = DEEPCRAWL_TEXT_LIMITS.total;
  let truncated = false;

  const results = pages.map((page, index) => {
    const content = typeof page.content === "string" ? page.content : "";
    const text = cutText(content, Math.min(DEEPCRAWL_TEXT_LIMITS.perPage, remaining));
    remaining -= text.length;
    const cut = text.length < content.length;
    truncated ||= cut;

    return {
      id: page.url,
      title: page.title || page.url,
      url: page.url,
      ...(text && { text }),
      metadata: {
        source: "search1api",
        position: index + 1,
        ...(cut && { truncated: true, content_length: content.length }),
      },
    };
  });

  return { results, truncated };
}

function completedResult(taskId: string, response: DeepcrawlStatusResponse): CallToolResult {
  const pages = Array.isArray(response.pages) ? response.pages : undefined;
  const { results, truncated } = pagesToResults(pages ?? []);
  const resultUrl = response.resultUrl || undefined;

  let note: string | undefined;
  if (truncated) {
    note = `Page text was shortened to fit this response (at most ${DEEPCRAWL_TEXT_LIMITS.perPage} characters per page and ${DEEPCRAWL_TEXT_LIMITS.total} in total); pages marked truncated in metadata are incomplete.${resultUrl ? " result_url holds every page in full;" : ""} read a single page in full with crawl.`;
  } else if (!pages && resultUrl) {
    note = "The result was too large to return inline; result_url holds every page.";
  } else if (results.length === 0) {
    note = "The crawl finished without pages; message says why.";
  }

  return toolResult({
    task_id: taskId,
    status: "completed",
    ...(response.message && { message: response.message }),
    results,
    ...(response.stats && { stats: response.stats }),
    failed: Array.isArray(response.failed) ? response.failed : [],
    ...(resultUrl && { result_url: resultUrl }),
    truncated,
    ...(note && { note }),
  });
}

function runningResult(taskId: string, lastError: unknown): CallToolResult {
  return toolResult({
    task_id: taskId,
    status: "running",
    results: [],
    note: `The crawl is still running. Call deepcrawl again with {"task_id": "${taskId}"} in a few seconds to collect the pages; checking costs no credits and does not start a new crawl.${lastError ? ` The last status check failed: ${formatError(lastError)}` : ""}`,
  });
}

/**
 * Implementation of the deepcrawl tool
 */
export async function handleDeepcrawl(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidDeepcrawlArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid deepcrawl arguments");
  }

  let taskId: string;
  const resuming = args.task_id !== undefined;

  if (args.task_id !== undefined) {
    taskId = args.task_id.trim();
    log("Checking deepcrawl task:", taskId);
  } else {
    log("Starting deepcrawl for:", args.url);
    try {
      const response = await makeRequest<DeepcrawlStartResponse>(
        API_CONFIG.ENDPOINTS.DEEPCRAWL,
        {
          url: args.url,
          ...(args.type !== undefined && { type: args.type }),
          max_pages: args.max_pages ?? 10,
          ...(args.include_paths !== undefined && { include_paths: args.include_paths }),
          ...(args.exclude_paths !== undefined && { exclude_paths: args.exclude_paths }),
          format: "json",
        },
        apiKey
      );
      if (typeof response?.taskId !== "string" || response.taskId.length === 0) {
        throw new Error("the API did not return a task id");
      }
      taskId = response.taskId;
    } catch (error) {
      log("Deepcrawl start error:", error);
      return errorResult(`Deepcrawl API error: ${formatError(error)}`);
    }
  }

  const deadline = Date.now() + DEEPCRAWL_POLLING.timeoutMs;
  let lastError: unknown;
  // A new task needs a moment before it can finish; an earlier one may already have.
  let waitFirst = !resuming;

  while (true) {
    if (waitFirst) {
      if (Date.now() + DEEPCRAWL_POLLING.intervalMs > deadline) {
        break;
      }
      await sleep(DEEPCRAWL_POLLING.intervalMs);
    }
    waitFirst = true;

    const check = await checkStatus(taskId, apiKey);
    if (check.kind === "error") {
      if (!check.retryable) {
        log("Deepcrawl status error:", check.error);
        return errorResult(`Deepcrawl API error: ${formatError(check.error)} (task_id ${taskId})`);
      }
      lastError = check.error;
      continue;
    }
    lastError = undefined;

    const { response } = check;
    const status = response.status ?? "processing";

    if (status === "completed") {
      return completedResult(taskId, response);
    }
    if (status === "failed") {
      return errorResult(
        `Deepcrawl task ${taskId} failed: ${response.error || response.message || "no reason given"}`
      );
    }
    if (status === "not_found") {
      // A task this call just started may not be visible yet; keep waiting.
      if (!resuming) {
        continue;
      }
      return errorResult(
        `Deepcrawl task ${taskId} was not found; it may have expired. Start a new crawl with url.`
      );
    }
    if (!RUNNING_STATUSES.has(status)) {
      log(`Unexpected deepcrawl status for ${taskId}: ${status}`);
    }
  }

  return runningResult(taskId, lastError);
}
