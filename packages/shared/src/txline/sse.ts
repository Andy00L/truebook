// Server-Sent Events parsing for TxLINE streams and historical replay.
// The historical endpoint returns SSE text (data: {...}\nid: N\n\n), not JSON.
// sourceRef: verified against /api/scores/historical on devnet.

import type { SseEvent } from "./types.js";

// Parse a complete SSE text body into discrete events. Events are separated by
// a blank line; each line is a "field: value" pair.
export function parseSseText(sseBody: string): SseEvent[] {
  const events: SseEvent[] = [];
  const rawBlocks = sseBody.split(/\r?\n\r?\n/);
  for (const rawBlock of rawBlocks) {
    const trimmedBlock = rawBlock.trim();
    if (trimmedBlock.length === 0) continue;
    const parsedEvent = parseSseBlock(trimmedBlock);
    if (parsedEvent) events.push(parsedEvent);
  }
  return events;
}

function parseSseBlock(block: string): SseEvent | null {
  let id: string | undefined;
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const field = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1).replace(/^ /, "");
    if (field === "id") id = value;
    else if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { id, event, data: dataLines.join("\n") };
}

// Parse the JSON payload of an SSE event into a typed object. Returns an error
// value rather than throwing so callers can skip malformed frames.
export function parseSseData<TPayload>(
  event: SseEvent,
): { ok: true; payload: TPayload } | { ok: false; reason: string } {
  try {
    return { ok: true, payload: JSON.parse(event.data) as TPayload };
  } catch (parseError) {
    return { ok: false, reason: `malformed SSE data: ${String(parseError)}` };
  }
}
