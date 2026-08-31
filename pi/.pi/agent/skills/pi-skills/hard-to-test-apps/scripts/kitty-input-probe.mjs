#!/usr/bin/env node
// kitty-input-probe.mjs — capture and dump raw terminal input bytes.
// Usage: node kitty-input-probe.mjs [timeout_sec=6] [outfile]
// Deps: node only. Working dir: anywhere.
// Enables kitty keyboard protocol flags 7, captures stdin (raw) for the
// timeout, then writes a readable hex dump (ESC sequences marked) to outfile
// or stdout. Run it inside the terminal under test and press the keys you
// want to inspect (press/hold/release/paste).
import { readFileSync, writeFileSync } from "node:fs";

const timeout = Number(process.argv[2] ?? 6) * 1000;
const outfile = process.argv[3];

process.stdout.write("\x1b[>7u\x1b[?u\x1b[c"); // request kitty protocol, query flags
process.stdin.setRawMode(true);
process.stdin.resume();

let buf = "";
process.stdin.on("data", (d) => {
	const s = d.toString("latin1");
	// mark escape sequences readably: split on ESC, hex the remainder
	buf +=
		s
			.split("\x1b")
			.map((part) => (part.length ? `ESC+[${Buffer.from(part, "latin1").toString("hex")}` : "ESC"))
			.join(" | ") + " | ";
});

setTimeout(() => {
	process.stdout.write("\x1b[<u"); // pop kitty protocol
	const report = `CAPTURED: ${buf || "(nothing)"}\n`;
	if (outfile) writeFileSync(outfile, report);
	else process.stderr.write(report + "\n");
	process.exit(0);
}, timeout);
