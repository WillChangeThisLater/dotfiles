/**
 * context-map.ts — visualize the live context window as a positional timeline.
 *
 * Commands:
 *   /context visualize  single kind track (what the context IS) — also the default
 *   /context value      disposition coloring (what is SAFE TO LOSE)
 *   /context list       text breakdown (kinds + disposition + compactable estimate)
 *   /context compact    compaction plan: top-20 costliest steps + 80/20; `a` accepts
 *
 * Accepting a plan appends `context_edit` entries to the session — the same
 * append-only mechanism pi's built-in compaction uses: originals stay in the
 * file, the projection applies the latest edit per target entry, and `/context
 * compact reset` restores by appending further edits. Compaction therefore
 * survives exit/restart, and `/context visualize` keeps painting the affected
 * spans (light violet = summarized, deep violet = dropped) across restarts.
 * While a plan is active, `/context visualize` paints the affected span in the
 * `compacted` color.
 *
 * Vocabulary (three tiers, per the session-log survey):
 *   Tier 1 "kind"     system · user · assistant · thinking · tool_call ·
 *                     tool_result · media · summary · custom · other
 *   Tier 2 "sub"      tool_call/tool_result → bash|read|edit|write|other-tool
 *                     media                  → image|audio|video
 *                     plus an `isError` overlay
 *   Tier 3 metadata   model_change / thinking_level_change / context_edit / …
 *                     carry ~no tokens and are excluded.
 *
 * Display rule: a single track colored by kind. The COMPACTION vocabulary
 * (keep/brief/regenerable/ephemeral/live) is derived internally from Tier 2 and
 * surfaced as annotations + the compactable estimate — it does not own colors.
 * `compactable` = drop (ephemeral/regenerable) + results (tool results worth
 * summarizing/stubbing); live-turn and keep items are excluded.
 * Tier-2 sub-kinds still drive the disposition mapping and the `list` breakdown;
 * they are not drawn (a second color track reads as clutter).
 *
 * x-axis = ordered context. Text is estimated at 4 chars ≈ 1 token; media uses
 * per-modality constants (image 1600, audio 1500, video 3000 tok) because base64
 * byte length is meaningless. Each cell is one truecolor background space, so
 * visible width is exact. Majority-vote per cell (not last-writer-wins).
 *
 * Notes:
 *   - Parent/live session only (buildContextEntries()); no subagent transcripts.
 *   - The system prompt is constructed at request time and is NOT counted.
 *   - Fixed 16 rows. Zoom is a follow-on.
 *   - Never throws into the agent run; failures degrade to a notify.
 */
import { BorderedLoader, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type RGB = [number, number, number];

// ---- Tier 1: kind (main track) ----
const KINDS = [
	"system", "user", "assistant", "thinking", "tool_call",
	"tool_result", "media", "summary", "custom", "other",
] as const;
type Kind = (typeof KINDS)[number];

const KIND_RGB: Record<Kind, RGB> = {
	system: [139, 92, 246], user: [59, 130, 246], assistant: [34, 197, 94],
	thinking: [163, 230, 53], tool_call: [245, 158, 11], tool_result: [239, 68, 68],
	media: [236, 72, 153], summary: [148, 163, 184], custom: [20, 184, 166],
	other: [100, 116, 139],
};
const KIND_LABEL: Record<Kind, string> = {
	system: "system", user: "user", assistant: "assistant", thinking: "thinking",
	tool_call: "tool call", tool_result: "tool result", media: "media",
	summary: "summary", custom: "custom", other: "other",
};

// Narrowing for `tool_result`: it is ~90% command output and ~9% file reads in
// practice, and those two have opposite compaction policies, so we peel them
// apart for drawing. edit/write confirmations are negligible and fold to other.
const RESULT_RGB: Record<string, RGB> = {
	result_bash: [239, 68, 68], result_read: [56, 189, 248], result_other: [190, 24, 93],
};
const RESULT_LABEL: Record<string, string> = {
	result_bash: "tool result · bash", result_read: "tool result · read", result_other: "tool result · other",
};

/** Drawn key: usually the kind, but tool results are narrowed by tool. */
function displayKind(it: Item): string {
	if (it.kind !== "tool_result") return it.kind;
	if (it.sub === "read") return "result_read";
	if (it.sub === "bash") return "result_bash";
	return "result_other";
}
const kindRgb = (k: string): RGB => RESULT_RGB[k] ?? KIND_RGB[k as Kind] ?? KIND_RGB.other;
const kindLabel = (k: string): string => RESULT_LABEL[k] ?? KIND_LABEL[k as Kind] ?? k;
function dispOfDisplay(k: string): Disp {
	switch (k) {
		case "result_read": return "regenerable";
		case "result_bash":
		case "result_other": return "brief";
		default: return settledDisp({ kind: k as Kind, sub: null, error: false, tokens: 0, preview: "", key: null, entryId: null });
	}
}

// ---- Tier 2: sub-kind (labels only; drives disposition mapping + list) ----
const SUB_LABEL: Record<string, string> = {
	bash: "bash", read: "read", edit: "edit", write: "write", "other-tool": "other tool",
	image: "image", audio: "audio", video: "video",
};
const EMPTY_RGB: RGB = [24, 24, 27];
// Overlay for items an accepted /context compact acted on. Deliberately violet
// ("condensed") rather than grey ("dead"): elided thinking/reads are gone or
// dormant, but summarized tool results are replaced by a live summary.
const SUMMARIZED_RGB: RGB = [196, 181, 253];
const ELIDED_RGB: RGB = [109, 78, 166];

// ---- derived layer: compaction disposition ----
type Disp = "keep" | "brief" | "regenerable" | "ephemeral" | "live";
const DISP_RGB: Record<Disp, RGB> = {
	keep: [34, 197, 94], brief: [20, 184, 166], regenerable: [245, 158, 11],
	ephemeral: [239, 68, 68], live: [59, 130, 246],
};
const DISP_FULL: Record<Disp, string> = {
	keep: "keep", brief: "brief", regenerable: "drop (regenerable)",
	ephemeral: "drop (ephemeral)", live: "live turn",
};

// Token constants for non-text content (base64 length is useless).
const MEDIA_TOKENS: Record<string, number> = { image: 1600, audio: 1500, video: 3000 };
const ROWS = 16;

// Persisted-compaction state. Accepting a plan appends `context_edit` entries
// (same mechanism as pi's built-in /compact): originals stay in the session
// file, the projection applies the latest edit per target, so compaction
// survives exit/restart and `reset` restores by appending further edits.
// summaryByCall caches model summaries by toolCallId for this runtime;
// editedOriginals remembers originals for reset (plus marker-matched edits
// from earlier runtimes).
let compactPasses = 0;
const summaryByCall = new Map<string, string>();
const editedOriginals = new Map<string, unknown>();

type Item = { kind: Kind; sub: string | null; error: boolean; tokens: number; preview: string; key: string | null; entryId: string | null };

const bg = (c: RGB, s: string) => `\x1b[48;2;${c[0]};${c[1]};${c[2]}m${s}\x1b[0m`;
const bgfg = (c: RGB, f: RGB, s: string) => `\x1b[48;2;${c[0]};${c[1]};${c[2]}m\x1b[38;2;${f[0]};${f[1]};${f[2]}m${s}\x1b[0m`;
const swatch = (c: RGB) => bg(c, "  ");

/** Normalize a raw tool name to a bounded sub-kind. */
function toolKey(name?: string): string {
	switch ((name ?? "").toLowerCase().trim()) {
		case "bash": return "bash";
		case "read": return "read";
		case "edit": return "edit";
		case "write": return "write";
		default: return "other-tool";
	}
}

function roleKind(role?: string): Kind {
	switch (role) {
		case "user": return "user";
		case "assistant": return "assistant";
		case "toolResult": return "tool_result";
		case "system": return "system";
		default: return "other";
	}
}

/** Token estimate for a single content block. */
function blockTokens(b: unknown): number {
	if (b == null) return 0;
	if (typeof b === "string") return b.length / 4;
	if (typeof b !== "object") return 0;
	const x = b as Record<string, unknown>;
	switch (x.type) {
		case "text": return String(x.text ?? "").length / 4;
		case "thinking": return String(x.thinking ?? "").length / 4;
		case "toolCall": return (String(x.name ?? "").length + JSON.stringify(x.arguments ?? {}).length) / 4;
		case "image": return MEDIA_TOKENS.image;
		case "audio": return MEDIA_TOKENS.audio;
		case "video": return MEDIA_TOKENS.video;
		default: return JSON.stringify(x).length / 4;
	}
}

function contentTokens(content: unknown): number {
	if (content == null) return 0;
	if (typeof content === "string") return content.length / 4;
	if (Array.isArray(content)) return content.reduce<number>((n, b) => n + blockTokens(b), 0);
	return blockTokens(content);
}

/** One-line preview of a content block, for the compaction plan. */
function snippet(raw: unknown, n = 72): string {
	const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, n);
	if (raw == null) return "";
	if (typeof raw === "string") return clean(raw);
	if (typeof raw !== "object") return "";
	const x = raw as Record<string, unknown>;
	switch (x.type) {
		case "text": return clean(String(x.text ?? ""));
		case "thinking": return clean(String(x.thinking ?? ""));
		case "toolCall": return clean(`${x.name ?? ""} ${JSON.stringify(x.arguments ?? {})}`);
		default: return "";
	}
}

/** Plain text of a message content value (for summaries/truncation). */
function plainText(content: unknown): string {
	if (content == null) return "";
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map((b) => {
			if (typeof b === "string") return b;
			const x = b as Record<string, unknown>;
			if (x.type === "text") return String(x.text ?? "");
			if (x.type === "thinking") return String(x.thinking ?? "");
			return x.type ? `[${String(x.type)}]` : "";
		}).join("\n");
	}
	return "";
}

/** Flatten session entries into an ordered list of categorized items. */
function classify(entries: unknown[]): Item[] {
	const items: Item[] = [];
	const add = (kind: Kind, tokens: number, sub: string | null = null, error = false, preview = "", key: string | null = null, entryId: string | null = null) => {
		if (tokens > 0) items.push({ kind, sub, error, tokens: Math.max(1, Math.round(tokens)), preview, key, entryId });
	};
	for (const raw of entries) {
		const e = raw as {
			type?: string;
			id?: string;
			message?: { role?: string; content?: unknown; toolName?: string; isError?: boolean; toolCallId?: string };
		};
		const entryId = typeof e.id === "string" ? e.id : null;
		if (e.type !== "message" || !e.message) {
			if (e.type === "compaction") add("summary", contentTokens(raw));
			else if (e.type === "custom" || e.type === "custom_message") add("custom", contentTokens(raw));
			continue;
		}
		const { role, content, toolName } = e.message;
		const isError = e.message.isError === true;
		const resultSub = role === "toolResult" ? toolKey(toolName) : null;
		const msgKey = role === "toolResult" ? (e.message.toolCallId ?? null) : null;

		if (Array.isArray(content)) {
			for (const b of content) {
				const bt = (b as { type?: string })?.type;
			if (bt === "thinking") add("thinking", blockTokens(b), null, false, snippet(b), null, entryId);
				else if (bt === "toolCall") add("tool_call", blockTokens(b), toolKey((b as { name?: string }).name), false, snippet(b), null, entryId);
				else if (bt === "image") add("media", blockTokens(b), "image", false, "[image]", null, entryId);
				else if (bt === "audio") add("media", blockTokens(b), "audio", false, "[audio]", null, entryId);
				else if (bt === "video") add("media", blockTokens(b), "video", false, "[video]", null, entryId);
				else add(roleKind(role), blockTokens(b), resultSub, isError, snippet(b), msgKey, entryId);
			}
			continue;
		}
		add(roleKind(role), contentTokens(content), resultSub, isError, snippet(content), msgKey, entryId);
	}
	return items;
}

/** Settled disposition, keyed off Tier 2 (tool_result:read is different from :bash). */
function settledDisp(it: Item): Disp {
	switch (it.kind) {
		case "system":
		case "user":
		case "assistant":
		case "summary":
		case "custom":
			return "keep";
		case "thinking":
			return "ephemeral";
		case "tool_call":
			return "brief";
		case "tool_result":
			return it.sub === "read" ? "regenerable" : "brief"; // reads re-fetchable; bash/edit output kept short
		case "media":
			return "regenerable"; // screenshot/attachment can usually be re-taken
		default:
			return "brief";
	}
}

/** Per-item disposition with the positional "live after last user message" rule. */
function dispositionsOf(items: Item[]): Disp[] {
	let lastUser = -1;
	items.forEach((it, i) => { if (it.kind === "user") lastUser = i; });
	return items.map((it, i) => (i > lastUser ? "live" : settledDisp(it)));
}

/**
 * Majority-vote color grid. `keyOf` returns the key an item contributes to, or
 * null to skip it (used for the sub-track). Cells with no weight become null.
 */
function buildGrid(
	items: Item[], keyOf: (it: Item, i: number) => string | null, total: number, W: number, R: number,
): (string | null)[] {
	const cells = W * R;
	const weights: Map<string, number>[] = Array.from({ length: cells }, () => new Map());
	const tpc = total / cells;
	let tok = 0;
	items.forEach((it, i) => {
		const start = tok;
		const end = tok + it.tokens;
		tok = end;
		const key = keyOf(it, i);
		if (key == null) return;
		const c0 = Math.max(0, Math.floor(start / tpc));
		const c1 = Math.min(cells, Math.ceil(end / tpc));
		for (let ci = c0; ci < c1; ci++) {
			const overlap = Math.min(end, (ci + 1) * tpc) - Math.max(start, ci * tpc);
			if (overlap > 0) weights[ci].set(key, (weights[ci].get(key) ?? 0) + overlap);
		}
	});
	return weights.map((m) => {
		let best: string | null = null;
		let bv = -1;
		for (const [k, v] of m) if (v > bv) (bv = v), (best = k);
		return best;
	});
}

/** Single track. Cells whose item errored get a white `!` on the kind color. */
function renderTrack(
	grid: (string | null)[], errGrid: (string | null)[], W: number, R: number, rgbOf: (k: string) => RGB,
): string[] {
	const lines: string[] = [];
	for (let r = 0; r < R; r++) {
		let line = "";
		for (let c = 0; c < W; c++) {
			const k = grid[r * W + c];
			const color = k == null ? EMPTY_RGB : rgbOf(k);
			line += errGrid[r * W + c] != null ? bgfg(color, [255, 255, 255], "!") : bg(color, " ");
		}
		lines.push(line);
	}
	return lines;
}

function ruler(W: number, total: number): string {
	let line = "";
	for (let i = 0; i < 6; i++) {
		const col = Math.round((i * (W - 1)) / 5);
		while (line.length < col) line += " ";
		const tok = Math.round((i * total) / 5);
		line += tok >= 1000 ? `${Math.round(tok / 1000)}k` : String(tok);
	}
	return truncateToWidth(`\x1b[2m${line}\x1b[0m`, W);
}

function legend(
	weights: Map<string, number>, total: number,
	rgbOf: (k: string) => RGB, labelOf: (k: string) => string, W: number,
): string {
	const parts = [...weights.entries()].sort((a, b) => b[1] - a[1])
		.map(([k, v]) => `${swatch(rgbOf(k))} ${labelOf(k)} ${((100 * v) / total).toFixed(0)}%`);
	return truncateToWidth(parts.join("  "), W);
}

function aggregate(items: Item[], keyOf: (it: Item, i: number) => string | null): Map<string, number> {
	const by = new Map<string, number>();
	items.forEach((it, i) => {
		const k = keyOf(it, i);
		if (k != null) by.set(k, (by.get(k) ?? 0) + it.tokens);
	});
	return by;
}

// ---- compaction plan helpers ----
// drop  = safe to elide outright (ephemeral thinking / regenerable reads+media)
// short = a tool result worth summarizing or stubbing (bash output, etc.)
// keep  = leave it alone; live = current-turn, never touch
type Comp = "drop" | "short" | "keep" | "live";
function compactClass(it: Item, d: Disp): Comp {
	if (d === "live") return "live";
	if (d === "regenerable" || d === "ephemeral") return "drop";
	if (it.kind === "tool_result") return "short";
	return "keep";
}
const COMP_LABEL: Record<Comp, string> = { drop: "drop", short: "short", keep: "keep", live: "live" };
const pct = (n: number, t: number) => `${((100 * n) / t).toFixed(1)}%`;
const kfmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
function describe(it: Item): string {
	return it.kind === "tool_result" ? `${it.sub ?? "tool"}: ${it.preview}` : it.preview;
}

/** Plain text of replacement content (string or text-block array). */
function contentText(c: unknown): string {
	if (typeof c === "string") return c;
	if (Array.isArray(c)) {
		return (c as Array<Record<string, unknown>>)
			.filter((b) => b?.type === "text")
			.map((b) => String(b.text ?? ""))
			.join("\n");
	}
	return "";
}

/** Latest context_edit per target → how it was compacted. Restored edits (replacement == original) are excluded. */
function computeEditedKinds(sm: any): Map<string, "dropped" | "summarized"> {
	const out = new Map<string, "dropped" | "summarized">();
	let all: unknown[] = [];
	try { all = (sm.getEntries?.() ?? []) as unknown[]; } catch { return out; }
	for (const raw of all) {
		const e = raw as { type?: string; targetId?: string; replacement?: { content?: unknown } | null };
		if (e.type !== "context_edit" || !e.targetId) continue;
		if (e.replacement === null) out.set(e.targetId, "dropped");
		else {
			const text = contentText(e.replacement?.content);
			if (text.includes("/context compact")) out.set(e.targetId, "summarized");
			else {
				// restored edit (content equals the original) → clear the overlay
				try {
					const orig = (sm.getEntry?.(e.targetId) as { message?: { content?: unknown } } | undefined)?.message?.content;
					if (orig !== undefined && JSON.stringify(orig) === JSON.stringify(e.replacement?.content)) out.delete(e.targetId);
					else out.set(e.targetId, "summarized");
				} catch { out.set(e.targetId, "summarized"); }
			}
		}
	}
	return out;
}

/** Append `context_edit` entries for every compactable item. Returns {applied, failed}. */
function persistEdits(sm: any, entries: unknown[], items: Item[], classes: Comp[]): { applied: number; failed: number } {
	const entryInfo = new Map<string, { role: string; content: unknown }>();
	for (const raw of entries) {
		const e = raw as { id?: string; message?: { role?: string; content?: unknown } };
		if (typeof e.id === "string" && e.message) entryInfo.set(e.id, { role: e.message.role ?? "", content: e.message.content });
	}
	const seen = new Set<string>();
	const manifest: Array<{ targetId: string; kind: string }> = [];
	let applied = 0;
	let failed = 0;
	items.forEach((it, i) => {
		if (classes[i] !== "drop" && classes[i] !== "short") return;
		const id = it.entryId;
		if (!id || seen.has(id)) return;
		seen.add(id);
		const info = entryInfo.get(id);
		if (!info || info.role === "user") return; // never edit user entries

		let replacement: { content: unknown } | null;
		if (info.role === "toolResult") {
			if (it.sub === "read") replacement = { content: "[file read elided by /context compact — re-read if needed]" };
			else {
				const sum = it.key != null ? summaryByCall.get(it.key) : undefined;
				const t = plainText(info.content).replace(/\s+/g, " ").trim();
				replacement = { content: sum ? `[summarized by /context compact] ${sum}` : `${t.slice(0, 400)}${t.length > 400 ? " …" : ""}\n[truncated by /context compact]` };
			}
		} else if (info.role === "assistant" && Array.isArray(info.content)) {
			const kept = (info.content as unknown[]).filter((b) => (b as { type?: string })?.type !== "thinking");
			replacement = kept.length ? { content: kept } : null; // pure-thinking entry → omit
		} else return; // custom/other roles: leave alone

		editedOriginals.set(id, info.content);
		try {
			sm.appendContextEdit(id, replacement);
			applied++;
		} catch { editedOriginals.delete(id); failed++; }
		manifest.push({ targetId: id, kind: info.role === "toolResult" ? (it.sub === "read" ? "dropped" : "summarized") : "dropped" });
	});
	// Manifest entry: durable list of every entry this accept compacted.
	// resetEdits reads this instead of guessing from replacement shapes — a
	// string-marker grep missed assistant array replacements and null omissions
	// (the F8 bug: ~170 of ~356 entries stayed violet after reset).
	if (manifest.length) {
		try { sm.appendCustomEntry("compaction-manifest", { targets: manifest, restored: false, pass: compactPasses + 1 }); }
		catch { /* manifest is an optimization; marker fallback still applies */ }
	}
	return { applied: seen.size, failed };
}

/** Restore compacted entries by appending further edits. Returns count restored. */
function resetEdits(sm: any): number {
	let n = 0;
	// 1) this runtime's accepts (fast path, in-memory originals)
	for (const [id, original] of editedOriginals) {
		try { sm.appendContextEdit(id, { content: original }); n++; } catch { /* leave compacted */ }
	}
	// 2) manifest entries: durable, written by THIS version's accepts and resets;
	// covers any runtime. `restored: true` entries mark already-restored targets
	// so reset is idempotent (a second reset must not re-append duplicates).
	try {
		const manifests: Array<{ targets?: Array<{ targetId: string }>; restored?: boolean }> = [];
		for (const raw of (sm.getEntries?.() ?? []) as unknown[]) {
			const e = raw as { type?: string; customType?: string; data?: unknown };
			if (e.type === "custom_message" && e.customType === "compaction-manifest") {
				manifests.push((e.data ?? {}) as { targets?: Array<{ targetId: string }>; restored?: boolean });
			}
		}
		const done = new Set(editedOriginals.keys());
		const restoredNow: Array<{ targetId: string }> = [];
		for (const m of manifests) {
			for (const t of m.targets ?? []) {
				if (!t.targetId || done.has(t.targetId)) continue;
				if (m.restored) { done.add(t.targetId); continue; } // already restored
				done.add(t.targetId);
				const orig = (sm.getEntry?.(t.targetId) as { message?: { content?: unknown } } | undefined)?.message?.content;
				if (orig === undefined) continue;
				try { sm.appendContextEdit(t.targetId, { content: orig }); restoredNow.push({ targetId: t.targetId }); n++; } catch { /* leave */ }
			}
		}
		// record what this reset restored so FUTURE runtimes' resets skip these
		// targets too (without this, cross-runtime idempotence leans on
		// appendContextEdit's no-op-on-identical behavior — not a contract)
		if (restoredNow.length) {
			try { sm.appendCustomEntry("compaction-manifest", { targets: restoredNow, restored: true, pass: 0 }); }
			catch { /* best effort */ }
		}
	} catch { /* ignore */ }
	// 3) legacy fallback: ONLY for sessions without manifests (pre-manifest
	// edits). String marker grep only — the array heuristic and marker-matching
	// against originals that merely mention "/context compact" both cause
	// duplicate restores (observed in regression: 404 spurious re-restores),
	// so when a manifest exists the fallback is skipped entirely.
	try {
		const hasManifests = ((sm.getEntries?.() ?? []) as unknown[]).some(
			(r) => (r as { type?: string; customType?: string }).type === "custom_message"
				&& (r as { customType?: string }).customType === "compaction-manifest",
		);
		if (!hasManifests) {
			const done = new Set(editedOriginals.keys());
			for (const raw of (sm.getEntries?.() ?? []) as unknown[]) {
				const e = raw as { type?: string; targetId?: string; replacement?: { content?: unknown } | null };
				if (e.type !== "context_edit" || !e.targetId || done.has(e.targetId)) continue;
				const rep = e.replacement?.content;
				if (rep === null || Array.isArray(rep)) continue; // unsafe to infer
				const text = contentText(rep);
				if (text && text.includes("/context compact")) {
					const orig = (sm.getEntry?.(e.targetId) as { message?: { content?: unknown } } | undefined)?.message?.content;
					if (orig !== undefined) {
						try { sm.appendContextEdit(e.targetId, { content: orig }); n++; } catch { /* leave */ }
					}
				}
			}
		}
	} catch { /* ignore */ }
	editedOriginals.clear();
	summaryByCall.clear();
	compactPasses = 0;
	return n;
}

/** Accept a plan: confirm, then summarize/stub with a spinner, then persist. */
async function acceptPlan(
	ctx: any, entries: unknown[], items: Item[], classes: Comp[], compactTok: number, total: number,
): Promise<void> {
	const dropN = classes.filter((c) => c === "drop").length;
	const shortItems = items.filter((_it, i) => classes[i] === "short");
	const freshShort = shortItems.filter((it) => it.key == null || !summaryByCall.has(it.key)).length;
	const shortNote = freshShort === shortItems.length
		? `${shortItems.length} tool results`
		: `${shortItems.length} tool results (${freshShort} new, ${shortItems.length - freshShort} already summarized)`;
	const ok = await ctx.ui.confirm(
		"Apply compaction plan?",
		`Elide ${dropN} items and summarize/stub ${shortNote}, recovering ~${kfmt(compactTok)} (${pct(compactTok, total)}).\n\nAffects subsequent requests. Undo with /context compact reset.`,
	);
	if (!ok) return;
	const model = ctx.model;
	const sm = ctx.sessionManager as any;
	if (!model) ctx.ui.notify("No model selected — using truncation stubs only.", "warning");
	const applied = (await ctx.ui.custom((tui: any, theme: any, _kb: any, finish: (v: boolean) => void) => {
		const loader = new BorderedLoader(tui, theme, "Compacting context…");
		loader.onAbort = () => finish(false);
		(async () => {
			try {
				if (!loader.signal.aborted && model) await summarizeShort(ctx, model, entries, items, classes, loader.signal);
			} catch {
				// fall through to truncation stubs
			}
			if (loader.signal.aborted) return finish(false);
			finish(true);
		})();
		return loader;
	}));
	if (applied) {
		const { applied: n, failed } = persistEdits(sm, entries, items, classes);
		compactPasses += 1;
		ctx.ui.notify(
			`Compacted ${n} entries (pass ${compactPasses})${failed ? `, ${failed} failed` : ""} — persisted to the session like /compact. Use /context compact reset to restore.`,
			"info",
		);
	} else ctx.ui.notify("Compaction cancelled.", "info");
}

/** One model call: summary per short tool result, keyed by toolCallId. */
async function summarizeShort(
	ctx: any, model: any, entries: unknown[], items: Item[], classes: Comp[], signal: AbortSignal,
): Promise<void> {
	const body = new Map<string, string>();
	for (const raw of entries) {
		const m = (raw as { message?: { role?: string; toolCallId?: string; content?: unknown } }).message;
		if (m?.role === "toolResult" && typeof m.toolCallId === "string") body.set(m.toolCallId, plainText(m.content));
	}
	const targets = items
		.map((it, i) => ({ it, i }))
		.filter((x) => classes[x.i] === "short" && x.it.key != null && body.has(x.it.key) && !summaryByCall.has(x.it.key));
	if (!targets.length) return;
	const listing = targets.slice(0, 40)
		.map((x) => `<result id="${x.it.key}">\n${(body.get(x.it.key!) ?? "").slice(0, 6000)}\n</result>`)
		.join("\n\n");
	const prompt = `Summarize each tool result below in at most 40 words, keeping concrete facts a later step might need (paths, names, numbers, errors). Output one line per result, formatted exactly "[id] summary". No other commentary.\n\n${listing}`;
	const response = await ctx.modelRegistry.complete(
		model,
		{ messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }] },
		{ maxTokens: 2000, signal, cacheRetention: "none" },
	);
	const txt = (response.content as any[])
		.filter((c) => c.type === "text")
		.map((c) => String(c.text))
		.join("\n");
	for (const line of txt.split("\n")) {
		const m = line.match(/^\s*\[([^\]]+)\]\s*(.+?)\s*$/);
		if (m) summaryByCall.set(m[1], m[2]);
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("context", {
		description: "Context window: `/context visualize` (default) · `value` dispositions · `list` text · `compact` plan",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) return;
			const sm = ctx.sessionManager as unknown as {
				buildContextEntries?: () => unknown[];
				getBranch?: () => unknown[];
			};
			const entries = (sm.buildContextEntries?.() ?? sm.getBranch?.() ?? []) as unknown[];
			const items = classify(entries);
			if (!items.length) return void ctx.ui.notify("No context to visualize", "warning");

			const total = items.reduce((n, it) => n + it.tokens, 0) || 1;
			const disps = dispositionsOf(items);
			const errCount = items.reduce((n, it) => n + (it.error ? 1 : 0), 0);
			const mode = args.trim().split(/\s+/)[0] || "visualize";
			const sub = args.trim().split(/\s+/)[1] ?? "";
			const classes = disps.map((d, i) => compactClass(items[i], d));
			const editedKinds = computeEditedKinds(sm);
			for (let i = 0; i < items.length; i++) {
				if (items[i].entryId && editedKinds.has(items[i].entryId as string)) classes[i] = "keep"; // already compacted
			}
			const dropTok = items.reduce((n, it, i) => n + (classes[i] === "drop" ? it.tokens : 0), 0);
			const resultTok = items.reduce((n, it, i) => n + (classes[i] === "short" ? it.tokens : 0), 0);
			const compactTok = dropTok + resultTok;
			const compactN = classes.filter((c) => c === "drop" || c === "short").length;

			if (mode === "compact" && sub === "reset") {
				const n = resetEdits(sm);
				ctx.ui.notify(n ? `Restored ${n} entries — original context returned for new requests.` : "Nothing to restore.", "info");
				return;
			}

			if (mode === "list") {
				const byKind = aggregate(items, (it) => displayKind(it));
				const kindRows = [...byKind.entries()].sort((a, b) => b[1] - a[1])
					.map(([k, v]) => `${kindLabel(k).padEnd(20)} ${DISP_FULL[dispOfDisplay(k)].padEnd(18)} ${String(v).padStart(8)} tok  ${((100 * v) / total).toFixed(1)}%`);
				const bySub = aggregate(items, (it) => it.sub);
				const subRows = [...bySub.entries()].sort((a, b) => b[1] - a[1])
					.map(([k, v]) => `${(SUB_LABEL[k] ?? k).padEnd(14)} ${"".padEnd(18)} ${String(v).padStart(8)} tok  ${((100 * v) / total).toFixed(1)}%`);
				ctx.ui.notify(
					`Context: ${total.toLocaleString()} tok · compactable ~${compactTok.toLocaleString()} (${pct(compactTok, total)}) [drop ${dropTok.toLocaleString()} / results ${resultTok.toLocaleString()}] · ${errCount} errors · system not counted\n` +
					`-- kinds --\n${kindRows.join("\n")}\n-- sub-kinds --\n${subRows.join("\n")}`,
					"info",
				);
				return;
			}

			if (mode === "compact") {
				const ranked = items
					.map((it, i) => ({ it, i }))
					.filter((x) => x.it.kind !== "system" && x.it.kind !== "user")
					.sort((a, b) => b.it.tokens - a.it.tokens)
					.slice(0, 20);
				const topTok = ranked.reduce((n, x) => n + x.it.tokens, 0);
				const topCompact = ranked.reduce((n, x) => n + (classes[x.i] === "drop" || classes[x.i] === "short" ? x.it.tokens : 0), 0);
				const sortedAll = items.map((it, i) => ({ it, i })).sort((a, b) => b.it.tokens - a.it.tokens);
				let acc = 0;
				let n80 = 0;
				for (const x of sortedAll) {
					acc += x.it.tokens;
					n80++;
					if (acc >= 0.8 * total) break;
				}

				const action = await ctx.ui.custom<string | undefined>((_tui, _theme, _kb, done) => ({
					render: (width: number) => {
						const W = Math.max(30, width - 2);
						const pad = " ";
						const out: string[] = [];
						const maxKind = Math.max(10, ...ranked.map((x) => kindLabel(displayKind(x.it)).length));
						out.push(pad + truncateToWidth(`\x1b[1mCompaction plan\x1b[0m  \x1b[2m${total.toLocaleString()} tok · ${items.length} items · system not counted\x1b[0m`, W));
						out.push(pad + truncateToWidth(`\x1b[2mcompactable ~${kfmt(compactTok)} (${pct(compactTok, total)}) = drop ${kfmt(dropTok)} (${pct(dropTok, total)}) + results ${kfmt(resultTok)} (${pct(resultTok, total)}) across ${compactN} items${compactPasses ? ` · ${editedKinds.size} entries compacted (pass ${compactPasses})` : ""}\x1b[0m`, W));
						out.push(pad + truncateToWidth(`\x1b[2m80/20: ${n80} of ${items.length} items hold 80% of the window · top ${ranked.length} = ${kfmt(topTok)} tok (${pct(topTok, total)}), ${kfmt(topCompact)} of it compactable (${pct(topCompact, total)})\x1b[0m`, W));
						out.push("");
						out.push(pad + truncateToWidth(`\x1b[2m  #  class  ${"kind".padEnd(maxKind)}   tokens      %    cum  detail\x1b[0m`, W));
						let cum = 0;
						ranked.forEach((x, n) => {
							cum += x.it.tokens;
							const label = COMP_LABEL[classes[x.i] as Comp];
							const kind = kindLabel(displayKind(x.it)).padEnd(maxKind);
							const line = `${String(n + 1).padStart(3)}  ${label.padEnd(5)} ${kind} ${kfmt(x.it.tokens).padStart(7)} ${pct(x.it.tokens, total).padStart(6)} ${pct(cum, total).padStart(6)}  ${describe(x.it)}`;
							out.push(pad + truncateToWidth(line, W));
						});
						out.push("");
						out.push(pad + truncateToWidth(`\x1b[2mdrop = elide · short = summarize/stub · keep = leave${compactPasses ? " · COMPACTION ON" : ""} · a = accept · r = reset · Enter/Esc\x1b[0m`, W));
						return out;
					},
					invalidate: () => {},
					handleInput: (data: string) => {
						if (data === "a") done("accept");
						else if (data === "r") done("reset");
						else if (matchesKey(data, "enter") || matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) done(undefined);
					},
				}));
				if (action === "accept") {
					await acceptPlan(ctx, entries, items, classes, compactTok, total);
				} else if (action === "reset") {
					const n = resetEdits(sm);
					ctx.ui.notify(n ? `Restored ${n} entries — original context returned for new requests.` : "Nothing to restore.", "info");
				}
				return;
			}

			const valueMode = mode === "value";
			const errKeysOf = (it: Item) => (it.error ? "err" : null);

			await ctx.ui.custom<undefined>((_tui, _theme, _kb, done) => ({
				render: (width: number) => {
					const W = Math.max(20, width - 2);
					const pad = " ";
					const out: string[] = [];
					const title = valueMode ? "Compaction map" : "Context map";
					const sub = `${total.toLocaleString()} tok · compactable ~${kfmt(compactTok)} (${pct(compactTok, total)}) [drop ${pct(dropTok, total)} + results ${pct(resultTok, total)}] · ${items.length} items · system not counted`;
					out.push(pad + truncateToWidth(`\x1b[1m${title}\x1b[0m  \x1b[2m${sub}\x1b[0m`, W));

					const errGrid = buildGrid(items, errKeysOf, total, W, ROWS);
					if (valueMode) {
						const dispGrid = buildGrid(items, (_it, i) => disps[i], total, W, ROWS);
						out.push(...renderTrack(dispGrid, errGrid, W, ROWS, (k) => DISP_RGB[k as Disp] ?? DISP_RGB.ephemeral).map((l) => pad + l));
						out.push(pad + ruler(W, total));
						out.push(pad + legend(aggregate(items, (_it, i) => disps[i]), total, (k) => DISP_RGB[k as Disp] ?? DISP_RGB.ephemeral, (k) => DISP_FULL[k as Disp] ?? k, W));
						out.push(pad + truncateToWidth(`\x1b[2mvalue view · Enter/Esc to close\x1b[0m`, W));
						return out;
					}

					const keyOf = (it: Item) => {
						const edited = it.entryId ? editedKinds.get(it.entryId) : undefined;
						if (edited === "dropped") return "elided";
						if (edited === "summarized") return "summarized";
						return displayKind(it);
					};
					const rgbOf = (k: string) =>
						(k === "elided" ? ELIDED_RGB : k === "summarized" ? SUMMARIZED_RGB : kindRgb(k));
					const labelOf = (k: string) =>
						(k === "elided" ? "compaction: dropped" : k === "summarized" ? "compaction: summarized" : kindLabel(k));
					const kindGrid = buildGrid(items, keyOf, total, W, ROWS);
					out.push(...renderTrack(kindGrid, errGrid, W, ROWS, rgbOf).map((l) => pad + l));
					out.push(pad + ruler(W, total));
					out.push(pad + legend(aggregate(items, keyOf), total, rgbOf, labelOf, W));
					out.push(pad + truncateToWidth(
						`\x1b[2m${editedKinds.size ? "compaction: summarized = replaced by a persisted summary · compaction: dropped = elided (dormant) · " : ""}${errCount > 0 ? `! = errored result (${errCount}) · ` : ""}Enter/Esc to close\x1b[0m`,
						W,
					));
					return out;
				},
				invalidate: () => {},
				handleInput: (data: string) => {
					if (matchesKey(data, "enter") || matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) done(undefined);
				},
			}));
		},
	});
}
