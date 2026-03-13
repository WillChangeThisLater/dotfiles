#!/usr/bin/env node
/**
 * Purpose: Send commands to xterm-based web terminals that expose `window.webTerminal.send`, then capture recent output.
 * Usage:   ./scripts/browser-term-send.js "ls -la" --tail 40 --wait 800
 *          ./scripts/browser-term-send.js --no-tail "npm test"
 * Dependencies: Node.js 18+, puppeteer-core (installed via `npm install` in browser-tools).
 * Working directory: Run from the `browser-tools` skill directory so relative imports resolve.
 */

import process from "node:process";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let waitMs = 400;
let tailLines = 20;
const commandParts = [];

for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];
	switch (arg) {
		case "--wait":
		case "--wait-ms": {
			const value = Number(args[i + 1]);
			if (Number.isFinite(value) && value >= 0) {
				waitMs = value;
				i += 1;
				continue;
			}
			console.error("✗ --wait expects a non-negative number (milliseconds)");
			process.exit(1);
		}
		case "--tail": {
			const value = Number(args[i + 1]);
			if (Number.isFinite(value) && value >= 0) {
				tailLines = value;
				i += 1;
				continue;
			}
			console.error("✗ --tail expects a non-negative number");
			process.exit(1);
		}
		case "--no-tail":
			tailLines = 0;
			continue;
		case "--help":
		case "-h":
			printUsage();
			process.exit(0);
		default:
			commandParts.push(arg);
	}
}

const commandText = commandParts.join(" ").trim();

if (!commandText) {
	printUsage();
	process.exit(1);
}

const browser = await connectToBrowser();
const page = (await browser.pages()).at(-1);

if (!page) {
	console.error("✗ No active Chrome tab found. Use browser-nav.js first.");
	await browser.disconnect();
	process.exit(1);
}

try {
	await page.evaluate((cmd) => {
		const api = window.webTerminal ?? null;
		if (!api || typeof api.send !== "function") {
			throw new Error(
				"window.webTerminal.send is unavailable. Make sure the client script exposes it."
			);
		}
		const normalized = cmd.endsWith("\r") ? cmd : `${cmd}\r`;
		api.send(normalized);
		return typeof api.socketState === "function" ? api.socketState() : undefined;
	}, commandText);
} catch (error) {
	console.error("✗ Failed to inject command:", error.message ?? error);
	await browser.disconnect();
	process.exit(1);
}

if (waitMs > 0) {
	if (typeof page.waitForTimeout === "function") {
		await page.waitForTimeout(waitMs);
	} else {
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}
}

let tailOutput = null;
if (tailLines > 0) {
	tailOutput = await page.evaluate((lineCount) => {
		const api = window.webTerminal ?? null;
		let lines = "";
		if (api && typeof api.tail === "function") {
			lines = api.tail(lineCount);
		} else {
			const rows = Array.from(document.querySelectorAll(".xterm-rows > div"));
			lines = rows
				.slice(-lineCount)
				.map((el) => el.textContent ?? "")
				.join("\n")
				.trimEnd();
		}
		return {
			status: document.getElementById("status")?.textContent ?? null,
			lines,
		};
	}, tailLines);
}

await browser.disconnect();

console.log(`→ ${commandText}`);
if (tailOutput?.status) {
	console.log(`[status] ${tailOutput.status}`);
}
if (tailLines > 0) {
	console.log(tailOutput?.lines || "(no terminal output captured yet)");
}

async function connectToBrowser() {
	return Promise.race([
		puppeteer.connect({
			browserURL: "http://localhost:9222",
			defaultViewport: null,
		}),
		new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
	]).catch((error) => {
		console.error("✗ Could not connect to Chrome:", error.message ?? error);
		console.error("  Run browser-start.js first.");
		process.exit(1);
	});
}

function printUsage() {
	console.log("Usage: scripts/browser-term-send.js [options] " + '"command"');
	console.log("");
	console.log("Options:");
	console.log("  --wait <ms>     Delay before reading output (default 400ms)");
	console.log("  --tail <lines>  Number of terminal lines to print (default 20)");
	console.log("  --no-tail       Skip capturing terminal output");
	console.log("  -h, --help      Show this message");
	console.log("");
	console.log("Example:");
	console.log("  ./scripts/browser-term-send.js --tail 40 --wait 800 \"npm test\"");
}
