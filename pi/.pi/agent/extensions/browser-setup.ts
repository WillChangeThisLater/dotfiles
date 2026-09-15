/**
 * browser-setup — run the X11 GUI automation setup script with the current
 * session UUID, so browser windows are scoped to the agent session.
 *
 * Usage:
 *   /browser-setup     runs ~/.pi/agent/skills/agent-generated/x11-gui-automation/scripts/setup.sh
 *                      with the session UUID as $1 and short tag as $2
 */

import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SETUP_SCRIPT = path.join(
	homedir(),
	".pi/agent/skills/pi-skills/x11-gui-automation/scripts/setup.sh",
);

export default function (pi: ExtensionAPI) {
	pi.registerCommand("browser-setup", {
		description: "Run browser setup script with the current session UUID",
		handler: async (_args, ctx) => {
			const uuid = ctx.sessionManager.getSessionId();
			const short = uuid.slice(0, 8);

			try {
				const stdout = execFileSync(SETUP_SCRIPT, [uuid, short], {
					cwd: ctx.cwd,
					encoding: "utf8",
				});
				const output = (stdout || "").trim();
				if (output) {
					ctx.ui.notify(output, "info");
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`browser-setup failed: ${message}`, "error");
			}
		},
	});
}
