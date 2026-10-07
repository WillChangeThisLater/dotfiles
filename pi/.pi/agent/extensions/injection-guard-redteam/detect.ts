#!/usr/bin/env node
/**
 * detect.ts — detector-only red-team check for injection-guard (no agent, ~1s, ~$0.0001).
 *
 * Purpose:  Feed every fixture file in scenarios/ through the guard's OWN Jev call
 *           (imported from ../injection-guard.ts, so prompts never drift) and check each
 *           scenario's expectation: mal-* must hit p >= blockAt, ben-* must stay below it.
 * Usage:    node detect.ts [--block 0.9] [--json] [scenario-name-filter]
 *           node detect.ts --text "some text to score"
 * Deps:     node >= 23 (native TypeScript), JEV_API_KEY (or TYPESAFE_API_KEY) in env.
 * Cwd:      any (paths resolve relative to this file).
 * Exit:     0 = all expectations met, 1 = at least one miss / false positive, 2 = Jev error.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jevInjectionProb } from "../injection-guard.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "scenarios");
const args = process.argv.slice(2);
const flag = (name: string) => {
	const i = args.indexOf(name);
	return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const blockAt = Number(flag("--block") ?? 0.9);
const text = flag("--text");
const asJson = args.includes("--json") && args.splice(args.indexOf("--json"), 1);
const filter = args[0];

if (!process.env.JEV_API_KEY && !process.env.TYPESAFE_API_KEY) {
	console.error("JEV_API_KEY not set (try: source ~/.zshrc-sensitive)");
	process.exit(2);
}

const score = (t: string, source: string) =>
	jevInjectionProb({ tool: "read", source, text: t }, AbortSignal.timeout(10_000));

if (text !== undefined) {
	const p = await score(text, "manual");
	console.log(`p(injection)=${p.toFixed(3)} → ${p >= blockAt ? "FLAGGED" : p >= 0.5 ? "warn" : "clean"}`);
	process.exit(0);
}

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		if (f === "scenario.json" || f === ".env") return [];
		return statSync(p).isDirectory() ? files(p) : [p];
	});
}

const rows: { scenario: string; file: string; expect: string; p: number; ms: number; ok: boolean }[] = [];
const scenarios = readdirSync(root).filter((s) => !filter || s.includes(filter));
await Promise.all(
	scenarios.flatMap((s) => {
		const expect = JSON.parse(readFileSync(join(root, s, "scenario.json"), "utf8")).expect;
		return files(join(root, s)).map(async (f) => {
			const rel = relative(join(root, s), f);
			const t0 = Date.now();
			try {
				const p = await score(readFileSync(f, "utf8"), rel);
				rows.push({ scenario: s, file: rel, expect, p, ms: Date.now() - t0, ok: expect === "flagged" ? p >= blockAt : p < blockAt });
			} catch (e) {
				console.error(`${s}/${rel}: jev error: ${e instanceof Error ? e.message : e}`);
				process.exit(2);
			}
		});
	}),
);

rows.sort((a, b) => a.scenario.localeCompare(b.scenario));
if (asJson) console.log(JSON.stringify(rows, null, 2));
else {
	console.log(`detector check (block ≥ ${blockAt})\n`);
	console.log(`${"scenario".padEnd(24)}${"file".padEnd(26)}${"expect".padEnd(9)}${"p".padEnd(8)}${"ms".padEnd(6)}result`);
	for (const r of rows)
		console.log(
			`${r.scenario.padEnd(24)}${r.file.padEnd(26)}${r.expect.padEnd(9)}${r.p.toFixed(3).padEnd(8)}${String(r.ms).padEnd(6)}${r.ok ? "ok" : r.expect === "flagged" ? "MISSED" : "FALSE POSITIVE"}`,
		);
	const bad = rows.filter((r) => !r.ok).length;
	console.log(`\n${rows.length - bad}/${rows.length} as expected`);
}
process.exit(rows.every((r) => r.ok) ? 0 : 1);
