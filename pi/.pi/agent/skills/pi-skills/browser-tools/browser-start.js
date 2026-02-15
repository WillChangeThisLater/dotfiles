#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let useProfile = false;
let binaryOverride;

for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];
	if (arg === "--profile") {
		useProfile = true;
		continue;
	}
	if (arg === "--binary") {
		binaryOverride = args[i + 1];
		i += 1;
		continue;
	}
	if (arg === "--help" || arg === "-h") {
		printUsage();
		process.exit(0);
	}
	console.error(`Unknown argument: ${arg}`);
	printUsage();
	process.exit(1);
}

function printUsage() {
	console.log("Usage: browser-start.js [--profile] [--binary /path/to/chrome]");
	console.log("");
	console.log("Options:");
	console.log("  --profile     Copy the user's default Chrome profile before launching");
	console.log("  --binary PATH Explicit Chrome/Chromium binary to launch");
	console.log("Environment overrides:");
	console.log("  BROWSER_TOOLS_CHROME or CHROME_PATH can also point to the binary");
}

const SCRAPING_DIR = `${process.env.HOME}/.cache/browser-tools`;

async function findChromeBinary() {
	const candidates = [
		binaryOverride,
		process.env.BROWSER_TOOLS_CHROME,
		process.env.CHROME_PATH,
		...platformDefaults(),
	].flatMap((value) => value ?? []).filter(Boolean);

	for (const candidate of candidates) {
		const resolved = resolveCandidate(candidate);
		if (resolved) {
			return resolved;
		}
	}

	return null;
}

function platformDefaults() {
	const list = [];
	if (process.platform === "darwin") {
		list.push(
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
			"/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		);
	}
	if (process.platform === "linux") {
		list.push(
			"/usr/bin/google-chrome-stable",
			"/usr/bin/google-chrome",
			"/usr/bin/chromium-browser",
			"/usr/bin/chromium",
			"/usr/bin/brave-browser",
			"google-chrome-stable",
			"google-chrome",
			"chromium-browser",
			"chromium",
			"brave-browser",
		);
	}
	if (process.platform === "win32") {
		const programFiles = process.env["PROGRAMFILES"];
		const programFilesX86 = process.env["PROGRAMFILES(X86)"];
		const localAppData = process.env.LOCALAPPDATA;
		if (programFiles) {
			list.push(path.join(programFiles, "Google/Chrome/Application/chrome.exe"));
		}
		if (programFilesX86) {
			list.push(path.join(programFilesX86, "Google/Chrome/Application/chrome.exe"));
		}
		if (localAppData) {
			list.push(path.join(localAppData, "Google/Chrome/Application/chrome.exe"));
		}
	}
	return list;
}

function resolveCandidate(candidate) {
	if (!candidate) {
		return null;
	}

	const expanded = candidate.startsWith("~")
		? path.join(process.env.HOME ?? "", candidate.slice(1))
		: candidate;

	if (expanded.includes("/") || expanded.includes("\\")) {
		return existsSync(expanded) ? expanded : null;
	}

	const lookupCommand = process.platform === "win32" ? `where "${expanded}"` : `command -v "${expanded}"`;
	try {
		const resolved = execSync(lookupCommand, {
			stdio: ["ignore", "pipe", "ignore"],
			encoding: "utf8",
		})
			.trim()
			.split(/\r?\n/)
			.find(Boolean);
		return resolved && existsSync(resolved) ? resolved : null;
	} catch {
		return null;
	}
}

const chromeBinary = await findChromeBinary();

if (!chromeBinary) {
	console.error("✗ Could not find a Chrome/Chromium binary.");
	console.error("  Provide one via --binary, BROWSER_TOOLS_CHROME, or CHROME_PATH.");
	process.exit(1);
}

// Check if already running on :9222
try {
	const browser = await puppeteer.connect({
		browserURL: "http://localhost:9222",
		defaultViewport: null,
	});
	await browser.disconnect();
	console.log("✓ Chrome already running on :9222");
	process.exit(0);
} catch {}

// Setup profile directory
execSync(`mkdir -p "${SCRAPING_DIR}"`, { stdio: "ignore" });

// Remove SingletonLock to allow new instance
try {
	execSync(
		`rm -f "${SCRAPING_DIR}/SingletonLock" "${SCRAPING_DIR}/SingletonSocket" "${SCRAPING_DIR}/SingletonCookie"`,
		{ stdio: "ignore" },
	);
} catch {}

if (useProfile) {
	console.log("Syncing profile...");
	try {
		execSync(
			`rsync -a --delete \
				--exclude='SingletonLock' \
				--exclude='SingletonSocket' \
				--exclude='SingletonCookie' \
				--exclude='*/Sessions/*' \
				--exclude='*/Current Session' \
				--exclude='*/Current Tabs' \
				--exclude='*/Last Session' \
				--exclude='*/Last Tabs' \
				"${process.env.HOME}/Library/Application Support/Google/Chrome/" "${SCRAPING_DIR}/"`,
			{ stdio: "pipe" },
		);
	} catch (error) {
		console.warn("⚠️  Could not copy profile:", error.message);
	}
}

spawn(
	chromeBinary,
	[
		"--remote-debugging-port=9222",
		`--user-data-dir=${SCRAPING_DIR}`,
		"--no-first-run",
		"--no-default-browser-check",
	],
	{ detached: true, stdio: "ignore" },
).unref();

let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await puppeteer.connect({
			browserURL: "http://localhost:9222",
			defaultViewport: null,
		});
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Chrome");
	process.exit(1);
}

console.log(`✓ Chrome started on :9222 using ${chromeBinary}`);
if (useProfile) {
	console.log("  (Profile copied into the scraping dir)");
}
