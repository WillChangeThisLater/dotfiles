#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let fileArg;
let useStdin = false;
const exprParts = [];

for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];
	if (arg === "--file" || arg === "-f") {
		fileArg = args[i + 1];
		i += 1;
		continue;
	}
	if (arg === "--stdin" || arg === "-s" || arg === "-") {
		useStdin = true;
		continue;
	}
	if (arg === "--help" || arg === "-h") {
		printUsage();
		process.exit(0);
	}
	exprParts.push(arg);
}

if (fileArg && useStdin) {
	console.error("✗ Use only one of --file or --stdin.");
	process.exit(1);
}

let code = "";

if (fileArg) {
	if (!fileArg) {
		console.error("✗ Missing value after --file");
		process.exit(1);
	}
	const resolved = path.resolve(fileArg);
	code = await fs.readFile(resolved, "utf8");
} else if (useStdin) {
	code = await readFromStdin();
} else {
	code = exprParts.join(" ");
}

if (!code.trim()) {
	printUsage();
	process.exit(1);
}

const asExpression = !fileArg && !useStdin;

const b = await Promise.race([
	puppeteer.connect({
		browserURL: "http://localhost:9222",
		defaultViewport: null,
	}),
	new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
]).catch((e) => {
	console.error("✗ Could not connect to browser:", e.message);
	console.error("  Run: browser-start.js");
	process.exit(1);
});

const p = (await b.pages()).at(-1);

if (!p) {
	console.error("✗ No active tab found");
	process.exit(1);
}

const result = await p.evaluate((c, shouldWrap) => {
	const AsyncFunction = (async () => {}).constructor;
	const body = shouldWrap ? `return (${c})` : c;
	return new AsyncFunction(body)();
}, code, asExpression);

if (Array.isArray(result)) {
	for (let i = 0; i < result.length; i++) {
		if (i > 0) console.log("");
		for (const [key, value] of Object.entries(result[i])) {
			console.log(`${key}: ${value}`);
		}
	}
} else if (typeof result === "object" && result !== null) {
	for (const [key, value] of Object.entries(result)) {
		console.log(`${key}: ${value}`);
	}
} else {
	console.log(result);
}

await b.disconnect();

function printUsage() {
	console.log("Usage: browser-eval.js [code] [--file path] [--stdin]");
	console.log("");
	console.log("Examples:");
	console.log('  browser-eval.js "document.title"');
	console.log("  browser-eval.js --file /tmp/script.js");
	console.log("  browser-eval.js --stdin < script.js");
	console.log("");
	console.log("Notes:");
	console.log("  • Inline code is treated as an expression. Wrap multi-line logic in an IIFE if needed.");
	console.log("  • When using --file/--stdin, the code is executed directly (no implicit return).");
}

function readFromStdin() {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", (error) => reject(error));
	});
}
