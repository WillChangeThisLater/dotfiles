/**
 * /move — live-migrate the current pi session to another host over ssh + tmux.
 *
 * Usage:
 *   /move <agent>@<host> [-t <tmux-session>] [--worktree] [--force-sync]
 *         [--no-autoapprove] [--no-term] [--attach] [--abort]
 *
 * Semantics (v0):
 * - Self-move only: moves the session running this command.
 * - Verify-then-cutover: nothing destructive happens until the remote pi
 *   instance is proven alive (pgrep on the session id + tmux window check).
 * - Always launches the remote pi inside tmux in a new window named <agent>.
 * - Without -t: dedicated remote session "pi-<agent>". With -t: new window
 *   in the named existing session.
 * - Transfer: auth.json, git bundle (commits) + rsync (working tree),
 *   session JSONL + manifest. node_modules/.git excluded, never --delete.
 * - --worktree: remote repo untouched; bundle is fetched and materialized in
 *   a detached-HEAD worktree at ~/pi-move/<repo>-<shortSessionId>. cwd changes.
 * - --force-sync: remote repo is reset to local HEAD (backup ref written first).
 *   Default (neither flag): requires remote HEAD == local HEAD, tree rsync only.
 * - Launch uses --approve unless --no-autoapprove (then strict verification).
 * - Context note injected via --append-system-prompt (old host, old cwd, new cwd).
 * - Cutover: detached shell kills the local tmux pane 2s after verification.
 * - Ports/listening services are NOT migrated (v0 limitation).
 */

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileP = promisify(execFile);
const RSYNC_EXCLUDES = [".git", "node_modules", "dist", "build", ".venv", ".cache"];
const MOVE_ROOT = "pi-move";

interface MoveOpts {
	agent: string;
	host: string;
	tmuxSession?: string;
	worktree: boolean;
	forceSync: boolean;
	noAutoapprove: boolean;
	noTerm: boolean;
	attach: boolean;
	abort: boolean;
}

class MoveError extends Error {}

function sh(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
	return execFileP(cmd, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

/** Run a command locally, returning null on failure instead of throwing. */
async function trySh(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string } | null> {
	try {
		return await sh(cmd, args);
	} catch (e: any) {
		return { stdout: e.stdout ?? "", stderr: e.stderr ?? String(e) };
	}
}

/** Run a command on the remote host over ssh (single round-trip, argv-safe). */
function ssh(host: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
	return sh("ssh", ["--", host, ...args]);
}

/** Single-quote a string for safe embedding in a remote shell command string. */
function sq(s: string): string {
	return "'" + s.replace(/'/g, "'\\''") + "'";
}

async function trySsh(host: string, args: string[]): Promise<{ stdout: string; stderr: string } | null> {
	try {
		return await ssh(host, args);
	} catch (e: any) {
		return { stdout: e.stdout ?? "", stderr: e.stderr ?? String(e) };
	}
}

/** Run ssh, resolving null on failure (non-zero exit) with stderr attached. */
function sshCode(host: string, args: string[]): Promise<{ stdout: string; stderr: string } | null> {
	return ssh(host, args).then(
		(r) => r,
		(e: any) => (e.stderr !== undefined ? null : Promise.reject(e)),
	);
}

function encodeCwdDir(cwd: string): string {
	return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

function parseArgs(raw: string): MoveOpts {
	const tokens = raw.trim().split(/\s+/).filter(Boolean);
	const positional: string[] = [];
	const opts: MoveOpts = {
		agent: "",
		host: "",
		worktree: false,
		forceSync: false,
		noAutoapprove: false,
		noTerm: false,
		attach: false,
		abort: false,
	};
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t === "-t") {
			opts.tmuxSession = tokens[++i];
		} else if (t === "--worktree") opts.worktree = true;
		else if (t === "--force-sync") opts.forceSync = true;
		else if (t === "--no-autoapprove") opts.noAutoapprove = true;
		else if (t === "--no-term") opts.noTerm = true;
		else if (t === "--attach") opts.attach = true;
		else if (t === "--abort") opts.abort = true;
		else if (t.startsWith("-")) throw new MoveError(`Unknown flag: ${t}`);
		else positional.push(t);
	}
	if (positional.length !== 1) {
		throw new MoveError("Usage: /move <agent>@<host> [-t <tmux-session>] [--worktree] [--force-sync] [--no-autoapprove] [--no-term] [--attach] [--abort]");
	}
	const m = positional[0].match(/^([a-zA-Z0-9_-]+)@([a-zA-Z0-9._-]+)$/);
	if (!m) throw new MoveError(`Target must be <agent>@<host>, got: ${positional[0]}`);
	opts.agent = m[1];
	opts.host = m[2];
	if (opts.worktree && opts.forceSync) throw new MoveError("--worktree and --force-sync are mutually exclusive");
	return opts;
}

async function localTmuxSelf(): Promise<{ paneId: string }> {
	if (!process.env.TMUX) throw new MoveError("Not inside tmux — /move requires running inside tmux (cutover kills the local pane).");
	const r = await trySh("tmux", ["display-message", "-p", "#{pane_id}"]);
	const paneId = r?.stdout.trim();
	if (!paneId || !paneId.startsWith("%")) throw new MoveError("Could not determine current tmux pane id.");
	return { paneId };
}

async function getPaneName(paneId: string): Promise<string | null> {
	const r = await trySh("tmux", ["display-message", "-p", "-t", paneId, "#{pane_title}"]);
	const n = r?.stdout.trim();
	return n && n !== "" ? n : null;
}

async function git(cwd: string, args: string[]): Promise<string> {
	const r = await sh("git", ["-C", cwd, ...args]);
	return r.stdout.trim();
}

async function gitOrNull(cwd: string, args: string[]): Promise<string | null> {
	const r = await trySh("git", ["-C", cwd, ...args]);
	if (!r || r.stderr.includes("fatal") || r.stderr.includes("error") || r.stderr.includes("not a git repository")) return null;
	return r.stdout.trim() || null;
}

async function remoteGit(host: string, cwd: string, args: string[]): Promise<string | null> {
	const r = await trySsh(host, ["git", "-C", cwd, ...args]);
	if (!r || r.stderr.includes("fatal") || r.stderr.includes("not a git repository")) return null;
	return r.stdout.trim() || null;
}

async function openTerminalWindow(attachCmd: string): Promise<boolean> {
	const candidates: string[] = [];
	if (process.env.TERMINAL) candidates.push(process.env.TERMINAL);
	const term = process.env.TERM_PROGRAM ?? "";
	if (term === "ghostty") candidates.push("ghostty");
	if (process.platform === "darwin") candidates.push("open");
	else candidates.push("gnome-terminal", "konsole", "alacritty", "kitty", "xterm");
	for (const c of candidates) {
		const which = await trySh("which", [c]);
		if (!which?.stdout.trim()) continue;
		const inner = `sh -c ${JSON.stringify(attachCmd)}`;
		let argv: string[];
		if (c === "open") argv = ["open", "-a", "Terminal", "bash", "--args", "-lc", inner];
		else if (c === "gnome-terminal") argv = [c, "--", "bash", "-lc", inner];
		else argv = [c, "-e", "bash", "-lc", inner];
		try {
			const child = spawn(argv[0], argv.slice(1), { detached: true, stdio: "ignore" });
			child.unref();
			return true;
		} catch {
			/* try next */
		}
	}
	return false;
}

async function attachCommand(host: string, tmuxSession: string, windowName: string, noTerm: boolean, attach: boolean, notify: (msg: string) => void): Promise<void> {
	const cmd = `ssh -t ${host} "tmux attach -t ${tmuxSession} \\; select-window '${windowName}'"`;
	if (noTerm) {
		notify(`Attach with: ${cmd}`);
		return;
	}
	if (attach) {
		notify(`After cutover, attach with: ${cmd}`);
		return;
	}
	const ok = await openTerminalWindow(cmd);
	if (!ok) notify(`No terminal emulator found. Attach with: ${cmd}`);
}

export default function (pi: ExtensionAPI) {
	/**
	 * /move-check <agent>@<host> — non-destructive dry run of everything /move
	 * checks, minus any transfer, launch, or cutover. Verifies ssh, remote pi
	 * (version + flag support), tmux/git/rsync, auth presence, project dir + git
	 * divergence state, tmux session collisions, and local session movability.
	 */
	pi.registerCommand("move-check", {
		description: "Preflight check for /move: /move-check <agent>@<host>",
		handler: async (args, ctx) => {
			const notify = (msg: string) => ctx.ui.notify(msg, "info");
			const results: string[] = [];
			const ok = (label: string, detail = "") => results.push(`OK    ${label}${detail ? ` — ${detail}` : ""}`);
			const warn = (label: string, detail = "") => results.push(`WARN  ${label}${detail ? ` — ${detail}` : ""}`);
			const bad = (label: string, detail = "") => results.push(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);

			let target: string;
			try {
				const m = args.trim().match(/^([a-zA-Z0-9_-]+)@([a-zA-Z0-9._-]+)$/);
				if (!m) throw new Error("Usage: /move-check <agent>@<host>");
				target = `${m[1]}@${m[2]}`;
			} catch (e: any) {
				ctx.ui.notify(e.message, "error");
				return;
			}
			const host = target.split("@")[1];

			// Local checks
			try {
				await localTmuxSelf();
				ok("local tmux pane detected");
			} catch (e: any) {
				bad("local tmux pane detected", e.message);
			}
			const sessionFile = ctx.sessionManager.getSessionFile();
			const sessionId = ctx.sessionManager.getSessionId();
			if (sessionFile && sessionId) ok("local session persisted", sessionId);
			else bad("local session persisted", "ephemeral session — nothing to move");
			const authLocal = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "auth.json");
			if (existsSync(authLocal)) ok("local auth.json present");
			else warn("local auth.json present", "remote will rely on its own credentials");

			// Remote checks (single ssh round-trip, same probe as /move)
			const cwd = process.cwd();
			notify(`Probing ${host}...`);
			const probe = await trySsh(host, [
				`cwd=${sq(cwd)}; ` +
					'echo PI=$(command -v pi || echo MISSING); pi --version 2>/dev/null; ' +
					'echo APPROVE=$(pi --help 2>/dev/null | grep -c -- --approve); ' +
					'echo TMUXV=$(tmux -V 2>/dev/null); echo GITV=$(git --version 2>/dev/null); ' +
					'echo RSYNCV=$(rsync --version 2>/dev/null | head -1); ' +
					'echo AUTH=$(test -f .pi/agent/auth.json && echo YES || echo NO); ' +
					'test -d "$cwd" && echo CWD_OK || echo CWD_MISSING; ' +
					'echo HOME=$HOME; git -C "$cwd" rev-parse HEAD 2>/dev/null; ' +
					'tmux list-sessions -F "#{session_name}" 2>/dev/null',
			]);
			if (!probe || (!probe.stdout && probe.stderr)) {
				bad(`ssh ${host}`, probe?.stderr?.trim() ?? "no response");
				ctx.ui.notify("/move-check results:\n" + results.join("\n"), "error");
				return;
			}
			ok(`ssh ${host}`);
			const lines = probe.stdout.trim().split("\n");
			const find = (p: string) => lines.find((l) => l.startsWith(p))?.slice(p.length);

			const piPath = find("PI=");
			if (!piPath || piPath === "MISSING") bad("remote pi on PATH", `not found on ${host}`);
			else {
				const localV = (await trySh("pi", ["--version"]))?.stdout.trim();
				const remoteV = lines.find((l) => /^\d+\.\d+\.\d+/.test(l.trim()))?.trim();
				if (remoteV && localV && remoteV !== localV)
					warn("remote pi version", `local=${localV} remote=${remoteV}`);
				else ok("remote pi version", remoteV ?? piPath);
				ok("remote pi --approve flag", find("APPROVE=") !== "0" ? "supported" : "not supported (launch adapts)");
			}
			for (const [label, pfx] of [["remote tmux", "TMUXV="], ["remote git", "GITV="], ["remote rsync", "RSYNCV="]] as const) {
				const v = find(pfx);
				if (v) ok(label, v);
				else bad(label, "missing on remote");
			}
			if (find("AUTH=") === "YES") ok("remote auth.json present");
			else warn("remote auth.json present", "/move will rsync it");

			const cwdOk = lines.includes("CWD_OK");
			const remoteHead = lines.find((l) => /^[0-9a-f]{40}$/.test(l));
			const localHead = await gitOrNull(cwd, ["rev-parse", "HEAD"]);
			if (!cwdOk) warn(`remote project dir`, `${cwd} missing — default mode refuses; --worktree or --force-sync will fail on git steps too unless repo exists`);
			else if (!remoteHead) warn(`remote project git`, `${cwd} exists but is not a git repo`);
			else if (localHead && remoteHead !== localHead)
				warn("git parity", `diverged: local=${localHead.slice(0, 8)} remote=${remoteHead.slice(0, 8)} — use --worktree or --force-sync`);
			else ok("git parity", remoteHead ? remoteHead.slice(0, 8) : "local not a git repo");

			const remoteSessions = lines.filter((l) => !l.includes("=") && !/^\d/.test(l) && l.trim() !== "");
			if (remoteSessions.length) ok("remote tmux sessions", remoteSessions.join(", "));
			else warn("remote tmux sessions", "none running");

			const fails = results.filter((r) => r.startsWith("FAIL")).length;
			const warns = results.filter((r) => r.startsWith("WARN")).length;
			const summary = `/move-check ${target}:\n${results.join("\n")}\n\n${fails ? `${fails} FAIL — /move will refuse` : warns ? `${warns} WARN — /move will proceed` : "all clear"}`;
			ctx.ui.notify(summary, fails ? "error" : "info");
		},
	});

	/**
	 * /move <agent>@<host> [-t <session>] [--worktree] [--force-sync]
	 * [--no-autoapprove] [--no-term] [--attach] [--abort]
	 */
	pi.registerCommand("move", {
		description: "Migrate this pi session to another host: /move <agent>@<host> [-t <session>] [--worktree] [--force-sync] [--no-autoapprove] [--no-term] [--attach] [--abort]",
		handler: async (args, ctx) => {
			const notify = (msg: string) => ctx.ui.notify(msg, "info");
			const fail = (msg: string) => ctx.ui.notify(msg, "error");
			let opts: MoveOpts;
			try {
				opts = parseArgs(args);
			} catch (e: any) {
				fail(e.message);
				return;
			}

			// ---- Phase 0: local checks + quiesce ----
			let selfPane: string;
			try {
				const t = await localTmuxSelf();
				selfPane = t.paneId;
			} catch (e: any) {
				fail(e.message);
				return;
			}

			const paneName = await getPaneName(selfPane);
			if (paneName && paneName !== opts.agent) {
				notify(`Warning: local pane is named "${paneName}", not "${opts.agent}" — proceeding with "${opts.agent}" for the remote.`);
			}

			const sessionFile = ctx.sessionManager.getSessionFile();
			const sessionId = ctx.sessionManager.getSessionId();
			if (!sessionFile || !sessionId) {
				fail("No persistent session (ephemeral mode) — nothing to move. Use a saved session.");
				return;
			}
			const cwd = process.cwd();
			const sessionName = pi.getSessionName() ?? opts.agent;

			if (!ctx.isIdle()) {
				if (!opts.abort) {
					fail("Agent is busy. Wait for idle or pass --abort to abort the current turn and queued messages.");
					return;
				}
				notify("Aborting current turn...");
				ctx.abort();
			}
			await ctx.waitForIdle();

			// ---- Phase 1: preflight ----
			notify(`Preflight on ${opts.host}...`);
			const probe = await trySsh(opts.host, [
				`cwd=${sq(cwd)}; ` +
					'echo PI=$(command -v pi || echo MISSING); pi --version 2>/dev/null; ' +
					'echo TMUXV=$(tmux -V 2>/dev/null); echo GITV=$(git --version 2>/dev/null); ' +
					'echo RSYNCV=$(rsync --version 2>/dev/null | head -1); ' +
					'test -d "$cwd" && echo CWD_OK || echo CWD_MISSING; ' +
					'echo HOME=$HOME; echo APPROVE=$(pi --help 2>/dev/null | grep -c -- --approve); ' +
					'git -C "$cwd" rev-parse HEAD 2>/dev/null; ' +
					'tmux list-sessions -F "#{session_name}" 2>/dev/null',
			]);
			if (!probe || probe.stderr.includes("Could not resolve") || probe.stderr.includes("Permission denied") || probe.stderr.includes("Connection refused")) {
				fail(`ssh to ${opts.host} failed: ${probe?.stderr?.trim() ?? "no response"}`);
				return;
			}
			const lines = probe.stdout.trim().split("\n");
			const piPath = lines.find((l) => l.startsWith("PI="))?.slice(3);
			if (!piPath || piPath === "MISSING") {
				fail(`pi not found on ${opts.host} (not on PATH).`);
				return;
			}
			const remotePiVersion = lines.find((l) => /^\d+\.\d+\.\d+/.test(l.trim()))?.trim();
			const localPiVersion = (await trySh("pi", ["--version"]))?.stdout.trim();
			if (remotePiVersion && localPiVersion && remotePiVersion !== localPiVersion) {
				notify(`Warning: pi version mismatch local=${localPiVersion} remote=${remotePiVersion} (session format should still be compatible).`);
			}
			for (const tool of ["TMUXV=", "GITV=", "RSYNCV="]) {
				if (!lines.some((l) => l.startsWith(tool) && l.length > tool.length)) {
					fail(`${tool.slice(0, -2)} missing on ${opts.host}.`);
					return;
				}
			}
			const cwdOk = lines.includes("CWD_OK");
			const remoteHome = lines.find((l) => l.startsWith("HOME="))?.slice(5) || "/home/paul";
			const remoteSupportsApprove = (lines.find((l) => l.startsWith("APPROVE="))?.slice(8) ?? "0") !== "0";
			const remoteHead = cwdOk && !opts.worktree ? (lines.find((l) => /^[0-9a-f]{40}$/.test(l)) ?? null) : null;
			const remoteSessions = lines.filter((l) => !l.includes("=") && !/^\d/.test(l) && l.trim() !== "");

			// ---- Phase 2: transfer ----
			const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
			const shortId = sessionId.slice(0, 8);
			const localHost = (await trySh("hostname", []))?.stdout.trim() ?? "unknown";
			const worktreePath = `${remoteHome}/${MOVE_ROOT}/${basename(cwd)}-${shortId}`;
			let finalCwd = cwd;

			notify("Transferring credentials...");
			const authLocal = join(agentDir, "auth.json");
			if (existsSync(authLocal)) {
				const r = await trySh("rsync", ["-az", authLocal, `${opts.host}:.pi/agent/auth.json.tmp`]);
				if (!r) {
					fail("Failed to rsync auth.json.");
					return;
				}
				await ssh(opts.host, ["mkdir -p .pi/agent && mv .pi/agent/auth.json.tmp .pi/agent/auth.json && chmod 600 .pi/agent/auth.json"]);
			}

			const localHead = await gitOrNull(cwd, ["rev-parse", "HEAD"]);
			let gitBundle: string | null = null;

			if (opts.worktree) {
				if (!localHead) {
					fail("Local project is not a git repo — --worktree requires one.");
					return;
				}
				notify("Creating git bundle...");
				gitBundle = `/tmp/pi-move-${shortId}.bundle`;
				await git(cwd, ["bundle", "create", gitBundle, "HEAD"]);
				const r = await trySh("rsync", ["-az", gitBundle, `${opts.host}:/tmp/`]);
				if (!r) {
					fail("Failed to upload git bundle.");
					return;
				}
				finalCwd = worktreePath;
			} else if (opts.forceSync) {
				if (!cwdOk || !remoteHead) {
					fail(`--force-sync requires an existing git repo at ${cwd} on ${opts.host}.`);
					return;
				}
				if (!localHead) {
					fail("Local project is not a git repo.");
					return;
				}
				notify("Creating git bundle...");
				gitBundle = `/tmp/pi-move-${shortId}.bundle`;
				await git(cwd, ["bundle", "create", gitBundle, "HEAD"]);
				const r = await trySh("rsync", ["-az", gitBundle, `${opts.host}:/tmp/`]);
				if (!r) {
					fail("Failed to upload git bundle.");
					return;
				}
			} else {
				if (!cwdOk) {
					fail(`Project directory ${cwd} does not exist on ${opts.host}. Use --worktree or set the repo up first.`);
					return;
				}
				if (localHead && remoteHead === null) {
					fail(`Remote ${cwd} is not a git repo (local is). Use --force-sync or --worktree.`);
					return;
				}
				if (localHead && remoteHead && remoteHead !== localHead) {
					fail(`Git divergence: local=${localHead.slice(0, 8)} remote=${remoteHead.slice(0, 8)}. Use --worktree (non-destructive) or --force-sync (resets remote, backup ref kept).`);
					return;
				}
			}

			if (gitBundle) {
				notify("Applying git state on remote...");
				if (opts.worktree) {
					const r = await trySsh(opts.host, [
						`git -C ${sq(cwd)} fetch -q /tmp/pi-move-${shortId}.bundle HEAD && ` +
							`git -C ${sq(cwd)} worktree remove --force ${sq(worktreePath)} 2>/dev/null; ` +
							`mkdir -p ${sq(remoteHome + "/" + MOVE_ROOT)} && git -C ${sq(cwd)} worktree add --detach -q ${sq(worktreePath)} FETCH_HEAD`,
					]);
					if (!r || r.stderr.trim() !== "") {
						fail(`Worktree creation failed: ${r?.stderr?.trim() ?? "unknown"}`);
						return;
					}
				} else {
					const r = await trySsh(opts.host, [
						`git -C ${sq(cwd)} branch -q move-backup/${shortId} HEAD 2>/dev/null; ` +
							`git -C ${sq(cwd)} fetch -q /tmp/pi-move-${shortId}.bundle HEAD && git -C ${sq(cwd)} reset -q --hard FETCH_HEAD`,
					]);
					if (!r || r.stderr.trim() !== "") {
						fail(`force-sync git reset failed: ${r?.stderr?.trim() ?? "unknown"} (remote backup ref move-backup/${shortId} preserved).`);
						return;
					}
				}
			}

			notify("Syncing working tree...");
			const excludeArgs = RSYNC_EXCLUDES.flatMap((ex) => ["--exclude", ex]);
			const r2 = await trySh("rsync", ["-az", "--exclude", ".git", ...excludeArgs, `${cwd}/`, `${opts.host}:${finalCwd}/`]);
			if (!r2) {
				fail("Working tree rsync failed.");
				return;
			}

			notify("Syncing session...");
			const remoteSessionsDir = `.pi/agent/sessions/${encodeCwdDir(finalCwd)}`;
			const r3 = await trySh("rsync", ["-az", sessionFile, `${opts.host}:${remoteSessionsDir}/`]);
			if (!r3) {
				fail("Session file rsync failed.");
				return;
			}

			// ---- Phase 3: launch ----
			const tmuxSessionName = opts.tmuxSession ?? `pi-${opts.agent}`;
			if (!opts.tmuxSession && remoteSessions.includes(tmuxSessionName)) {
				notify(`Remote session "${tmuxSessionName}" already exists — killing it (dedicated /move session) and recreating.`);
				await trySsh(opts.host, ["tmux", "kill-session", "-t", tmuxSessionName]);
			}

			const note =
				`This session was moved from host ${localHost} at ${new Date().toISOString()}. ` +
				(finalCwd !== cwd ? `Previous working directory was ${cwd}; it now lives at ${finalCwd}. ` : "") +
				`Listening services from the old host are NOT migrated (v0 limitation).`;

			notify(`Launching on ${opts.host}...`);
			const remoteCmd =
				`cd ${finalCwd} && pi --session ${sessionId} --name ${JSON.stringify(sessionName)}` +
				(opts.noAutoapprove ? "" : remoteSupportsApprove ? " --approve" : "") +
				` --append-system-prompt ${JSON.stringify(note)}`;
			const launch = await sshCode(opts.host, [
				opts.tmuxSession
					? `tmux new-window -t ${sq(opts.tmuxSession)} -n ${sq(opts.agent)} -d ${sq(remoteCmd)}`
					: `tmux new-session -d -s ${sq(tmuxSessionName)} -n ${sq(opts.agent)} ${sq(remoteCmd)}`,
			]);
			if (!launch) {
				fail(`Remote launch failed (tmux could not create ${tmuxSessionName}:${opts.agent} on ${opts.host}).`);
				return;
			}
			// Name the pane too so messaging tooling finds it; select the new window.
			const windowTarget = opts.tmuxSession ? `${opts.tmuxSession}` : tmuxSessionName;
			await trySsh(opts.host, ["tmux", "select-pane", "-T", opts.agent]);
			await trySsh(opts.host, ["tmux", "select-window", "-t", windowTarget, opts.agent]);

			// ---- Phase 4: verify ----
			notify("Verifying remote startup...");
			let verified = false;
			let lastCapture = "";
			for (let i = 0; i < 20; i++) {
				await new Promise((r) => setTimeout(r, 1500));
				const alive = await trySsh(opts.host, [`pgrep -f -- ${sq(`--session ${sessionId}`)} >/dev/null && echo ALIVE`]);
				if (!alive || !alive.stdout.includes("ALIVE")) {
					// still starting or died; check window presence
					const win = await trySsh(opts.host, ["tmux", "list-windows", "-t", windowTarget, "-F", "#{window_name}"]);
					if (!win || !win.stdout.split("\n").includes(opts.agent)) {
						break; // window gone — launch died
					}
					continue;
				}
				const cap = await trySsh(opts.host, ["tmux", "capture-pane", "-p", "-t", `${windowTarget}:${opts.agent}`]);
				lastCapture = cap?.stdout ?? "";
				if (lastCapture.trim() === "") continue;
				if (opts.noAutoapprove && /trust|Trust/.test(lastCapture)) {
					break;
				}
				// TUI renders the working directory in the footer; require non-empty capture plus live process
				verified = true;
				break;
			}

			if (!verified) {
				const tail = lastCapture.split("\n").filter((l) => l.trim()).slice(-5).join(" | ");
				fail(
					`Remote verification failed on ${opts.host}. Local instance untouched.` +
						(tail ? ` Pane tail: ${tail}` : ""),
				);
				return;
			}

			// Manifest (remote, for the record)
			const manifest = JSON.stringify({
				sessionId,
				from: localHost,
				fromCwd: cwd,
				toCwd: finalCwd,
				at: new Date().toISOString(),
			});
			await trySsh(opts.host, [
				`mkdir -p ${sq(`${remoteHome}/${MOVE_ROOT}/manifests`)} && ` +
					`printf '%s\\n' ${sq(manifest)} > ${sq(`${remoteHome}/${MOVE_ROOT}/manifests/${shortId}.json`)}`,
			]);

			// ---- Phase 5: cutover ----
			await attachCommand(opts.host, windowTarget, opts.agent, opts.noTerm, opts.attach, notify);
			notify(`Verified on ${opts.host} (tmux ${windowTarget}:${opts.agent}). Cutting over local pane ${selfPane}...`);
			// Detached kill so this process (inside the pane being killed) can finish.
			const child = spawn("sh", ["-c", `sleep 2 && tmux kill-pane -t ${selfPane}`], {
				detached: true,
				stdio: "ignore",
			});
			child.unref();
			if (opts.attach || opts.noTerm) {
				// Nothing else to do; the notify above carries the command.
			}
		},
	});
}
