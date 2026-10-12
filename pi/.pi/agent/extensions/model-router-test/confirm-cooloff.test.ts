/**
 * confirm-cooloff.test.ts — deterministic test of model-router's switch-confirm popup + cooloff.
 *
 * Purpose:  drive the real model-router.ts extension with a fake pi API, a stubbed classifier
 *           (fetch), and scripted ctx.ui.select answers — no network, no LLM turns burned.
 * Usage:    node ~/.pi/agent/extensions/model-router-test/confirm-cooloff.test.ts
 * Deps:     Node ≥ 23.6 (native TypeScript type stripping). Nothing else.
 * Cwd:      any. Uses a temp HOME, so ~/.pi/agent/settings.json is never read or written.
 *
 * NOTE: this dir has no index.ts on purpose, so pi does not auto-load it as an extension.
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// --- isolated HOME with a known config (kev = localhost, no API key needed) ---
const home = mkdtempSync(join(tmpdir(), "model-router-test-"));
mkdirSync(join(home, ".pi", "agent"), { recursive: true });
writeFileSync(
  join(home, ".pi", "agent", "settings.json"),
  JSON.stringify({ modelRouter: { enabled: true, classifier: "kev", confirmSwitch: true, cooloffTurns: 5 } }),
);
process.env.HOME = home;

const { default: activate } = await import("../model-router.ts");

const OPUS = "openrouter/anthropic/claude-opus-5.5"; // "design" route
const FLASH = "openrouter/z-ai/glm-5.3-flash"; // "chat" route

/** Classifier answers, one per turn: [task, confidence]. */
let script: [string, number][] = [];
globalThis.fetch = (async () => {
  const [choice, confidence] = script.shift() ?? ["chat", 0];
  return {
    ok: true,
    json: async () => ({ answers: { task: { type: "choice", choice, confidence, probabilities: { [choice]: confidence } } } }),
  };
}) as any;

/** Spin up a fresh extension instance; returns a driver. */
function harness(selectAnswers: (string | undefined | "SWITCH" | "KEEP" | "DISABLE")[]) {
  script = []; // isolate tests: a crashed test must not leave answers for the next one
  const handlers: Record<string, Function> = {};
  const prompts: number[] = []; // turn numbers on which the popup appeared
  const switches: string[] = [];
  const statuses: string[] = [];
  let turn = 0;

  const ctx: any = {
    hasUI: true,
    model: { provider: "openrouter", id: OPUS.slice("openrouter/".length) },
    modelRegistry: { find: (provider: string, id: string) => ({ provider, id }) },
    sessionManager: { getBranch: () => [], getEntries: () => [] },
    ui: {
      setStatus: (_k: string, t: string) => statuses.push(`turn ${turn}: ${t}`),
      notify: () => {},
      select: async (_title: string, options: string[]) => {
        prompts.push(turn);
        const a = selectAnswers.shift();
        if (a === undefined) return undefined; // escape
        const want = a === "SWITCH" ? "Switch" : a === "DISABLE" ? "disable routing" : "(this turn)";
        return options.find((o) => o.includes(want));
      },
    },
  };
  const pi: any = {
    on: (ev: string, fn: Function) => (handlers[ev] = fn),
    registerCommand: () => {},
    setModel: async (m: any) => {
      switches.push(`${m.provider}/${m.id}`);
      ctx.model = m;
      return true;
    },
    setThinkingLevel: () => {},
    appendEntry: () => {},
  };
  activate(pi);

  return {
    prompts,
    switches,
    statuses,
    async turns(answers: [string, number][]) {
      script.push(...answers);
      for (let i = 0; i < answers.length; i++) {
        turn++;
        await handlers.before_agent_start({ prompt: `turn ${turn}` }, ctx);
      }
    },
  };
}

const HI: [string, number] = ["chat", 0.9]; // above kev's 0.3 gate
const LO: [string, number] = ["chat", 0.1]; // below it

const tests: [string, () => Promise<void>][] = [
  [
    "decline → no reprompt for exactly 5 turns, then reprompts; accept switches",
    async () => {
      const h = harness(["KEEP", "SWITCH"]);
      await h.turns(Array(8).fill(HI));
      // turn 1: hysteresis (no streak yet). turn 2: popup → declined. turns 3-7: cooloff. turn 8: popup.
      assert.deepEqual(h.prompts, [2, 8]);
      assert.deepEqual(h.switches, [FLASH]);
    },
  ],
  [
    "escape (dismissed popup) counts as a decline, never switches",
    async () => {
      const h = harness([undefined]);
      await h.turns(Array(7).fill(HI));
      assert.deepEqual(h.prompts, [2]);
      assert.deepEqual(h.switches, []);
    },
  ],
  [
    "low-confidence turns still tick the cooloff down (regression)",
    async () => {
      const h = harness(["KEEP", "SWITCH"]);
      await h.turns([HI, HI, LO, LO, LO, LO, LO, HI]);
      assert.deepEqual(h.prompts, [2, 8]);
      assert.deepEqual(h.switches, [FLASH]);
    },
  ],
  [
    "'disable routing' stops all further prompts",
    async () => {
      const h = harness(["DISABLE"]);
      await h.turns(Array(10).fill(HI));
      assert.deepEqual(h.prompts, [2]);
      assert.deepEqual(h.switches, []);
    },
  ],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`FAIL  ${name}\n      ${e.message.split("\n").join("\n      ")}`);
  }
}
console.log(failed ? `\n${failed} failed` : `\nall ${tests.length} passed`);
process.exit(failed ? 1 : 0);
