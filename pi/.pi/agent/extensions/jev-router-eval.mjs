#!/usr/bin/env node
/**
 * jev-router-eval.mjs — end-to-end eval of the jev-router classification battery.
 *
 * Runs each labeled prompt through POST /v1/systemone with the same questions the
 * extension uses, prints per-prompt task/confidence, and summarizes:
 *  - per-label mean/max confidence (is 0.98 reachable per route?)
 *  - misclassifications vs. human label
 *
 * Usage: JEV_API_KEY=... node jev-router-eval.mjs [filter-substring]
 * Edit PROMPTS below to extend the corpus. Labels are "what the human would want".
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

// [label, prompt] — label ∈ chat|coding|testing|review|debugging|design
const PROMPTS = [
  ["chat", "hi there"],
  ["chat", "what does the useMemo hook do?"],
  ["chat", "i have a circuit: an LED is on the same node as a capacitor. i notice when i take the capacitor out the LED gets brighter faster. why is this the case?"],
  ["chat", "tmux how can i send a notification that will show up as a pop up?"],
  ["chat", "is I here amperage? if so what is C?"],
  ["coding", "check out the code for jqlm. i want to modify this to work with 'jev'... do NOT implement anything, just do some research and see what you think."],
  ["coding", "i am testing something. modify the daemon logs to make it seem like facebook was the top post on hackernews."],
  ["coding", "add input validation to the API routes"],
  ["coding", "i want to create a daemon that checks on other agents every 15 minutes."],
  ["coding", "draft a response for me. i'm not interested in this role: $65/hr is low..."],
  ["design", "can you help me design something?"],
  ["design", "design a spaceship for me"],
  ["design", "i want you to help me think of ways we can bake 'jev' into the pi harness... do some brainstorming - what do you think?"],
  ["debugging", "why isn't my bluetooth connecting to my mouse?"],
  ["debugging", "yeah check to see if one is running. i am running notify-send but to no avail"],
  ["debugging", "run commands to figure this out"],
  ["review", "how are the sandbox escape runs here looking?"],
  ["review", "review everything you just changed"],
  ["review", "take a screenshot on x display 0. save as ~/Downloads/uas_cert"],
  ["testing", "give me 3-5 sample leetcode problems so i can practice python skills"],
  ["testing", "run the full test suite and tell me what fails"],
  ["debugging", "there are a bunch of agent cron jobs running as part of the ai-job-search project. can you axe these for me?"],
  ["coding", "run kernel-bt-fix-watch manually and see if that bluetooth fix shipped"],
  ["chat", "continue"],
  ["chat", "ok go ahead"],
  ["chat", "yeah doctor everything."],
  ["chat", "bot check should be fine - can't you use x11-gui-automation to bypass this?"],
];

const QUESTIONS = {
  task: {
    type: "choice",
    instructions: "Which task type best fits this agent conversation state and current prompt?",
    criteria: {
      chat: "Casual conversation, factual question, or follow-up chatter not requiring code changes",
      coding: "Writing, editing, or refactoring code",
      testing: "Writing or running tests",
      review: "Reviewing existing code or recent changes for problems",
      debugging: "Diagnosing failures, errors, or unexpected behavior",
      design: "Architecture or high-level design work",
    },
  },
  complexity: {
    type: "score",
    instructions: "How cognitively complex is the current request?",
    criteria: ["trivial chat or lookup", "simple well-scoped change", "moderate multi-step work", "hard debugging or cross-cutting change", "architecture-level design"],
  },
  risky: { type: "noul", instructions: "Does the current prompt plausibly request a destructive or risky operation?" },
};

const apiKey = process.env.JEV_API_KEY ?? readFileSync(homedir() + "/.jev_key_placeholder", "utf8");
const base = process.env.JEV_BASE_URL ?? "https://api.typesafe.ai/v1";
const filter = process.argv[2];

const results = [];
for (const [label, prompt] of PROMPTS) {
  if (filter && !prompt.includes(filter)) continue;
  const state = { turn: 1, recent_user_messages: [prompt.slice(0, 200)], recent_assistant_actions: [], activity: { tools_last_turn: [], files_touched: [], errors_last_turn: false }, current_prompt: prompt.slice(0, 1000) };
  const t0 = performance.now();
  let r;
  try {
    const res = await fetch(`${base}/systemone`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.JEV_MODEL ?? "jev-latest", state, questions: QUESTIONS }),
    });
    const json = await res.json();
    r = { ok: true, ms: Math.round(performance.now() - t0), ...pick(json) };
  } catch (e) {
    r = { ok: false, err: String(e).slice(0, 80), ms: Math.round(performance.now() - t0) };
  }
  results.push({ label, prompt, ...r });
  const mark = r.ok ? (r.task === label ? " " : "!") : "X";
  console.log(
    `${mark} [${label.padEnd(9)}] conf=${(r.conf ?? 0).toFixed(2)} ${String(r.ms).padStart(4)}ms ` +
      `cx=${(r.cx ?? 0).toFixed(1)} risky=${(r.risky ?? 0).toFixed(2)} → ${(r.task ?? r.err ?? "?").padEnd(9)} | ${prompt.slice(0, 70)}`,
  );
}

function pick(json) {
  const a = json?.answers;
  if (!a) return { err: JSON.stringify(json).slice(0, 80) };
  return {
    task: a.task?.choice,
    conf: a.task?.confidence,
    probs: a.task?.probabilities,
    cx: a.complexity?.score,
    risky: a.risky?.noul,
  };
}

console.log("\n=== summary by human label (standalone turn-1 state) ===");
const byLabel = {};
for (const r of results) {
  (byLabel[r.label] ??= []).push(r);
}
for (const [label, rs] of Object.entries(byLabel)) {
  const confs = rs.filter((r) => r.ok).map((r) => r.conf);
  const correct = rs.filter((r) => r.ok && r.task === label).length;
  const mean = confs.length ? confs.reduce((a, b) => a + b) / confs.length : NaN;
  console.log(
    `${label.padEnd(9)} n=${String(rs.length).padStart(2)} correct=${String(correct).padStart(2)} ` +
      `meanConf=${mean.toFixed(2)} maxConf=${Math.max(...confs, 0).toFixed(2)} ` +
      `≥0.98: ${confs.filter((c) => c >= 0.98).length}/${confs.length}`,
  );
}
const lat = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
console.log(`\nlatency: p50=${lat[lat.length >> 1]}ms p95=${lat[Math.floor(lat.length * 0.95)]}ms max=${lat[lat.length - 1]}ms`);
