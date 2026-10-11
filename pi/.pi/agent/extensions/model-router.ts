/**
 * model-router.ts — auto model routing for pi via System One decision-model classifiers.
 *
 * On every user submit (before_agent_start), builds a compact state digest of the
 * recent conversation, sends one parallel classifier question battery (task-type
 * choice + complexity score + risky-operation noul), and — only when the classifier
 * is very confident and the classification has persisted (hysteresis) — switches the
 * active model via pi.setModel().
 *
 * Classifiers (configurable profiles, switchable at runtime):
 *   - "jev": TypeSafe's hosted Jev (api.typesafe.ai, needs JEV_API_KEY). Sharp
 *     probabilities → confidence values run high (0.9+ when correct).
 *   - "kev": local llama.cpp decision model (Kev-4B GGUF via /v1/systemone on
 *     127.0.0.1:8080). Same protocol, same confidence formula, but the GGUF ships
 *     calibration temperature 2.406, so confidences run much lower (~0.3-0.5) for
 *     the same effective certainty. Thresholds are per-classifier for this reason.
 *   Any llama.cpp System One endpoint (OpenJev, Laya, ...) works as another profile.
 *
 * Design invariants:
 *  - One classification per turn, resolved before dispatch or dropped entirely
 *    (late answers after the timeout are discarded, never applied).
 *  - All failure modes (timeout, network, auth, malformed) fail open: keep the
 *    current model, show a brief status note, never block or error the turn.
 *  - Switches only when the routed model exists and has credentials.
 *
 * Explicit switch directives: a prompt like "switch to X now" is detected by an extra
 * classifier question (model_switch) and resolved against the catalog by name; it then
 * confirms + switches immediately. Any explicit switch pins the model — auto routing is
 * suppressed until /model-routing unpin, another explicit switch request, or a manual
 * /model switch. (A deferred/armed "switch after this run" variant was tried and removed:
 * mid-run phase boundaries can't be honored reliably, and sending the switch as its own
 * message at the phase boundary is simpler and always works.)
 *
 * Config: ~/.pi/agent/settings.json -> { "modelRouter": { ... } }. The legacy
 * "jevRouter" key is migrated automatically (its per-route minConfidence values
 * move into the jev profile's routeConf). The enabled flag is session-only and
 * never persisted (a session toggle survives any other config save).
 *
 * Commands: /model-routing (alias /jev):
 *   on | off                          session-only toggle of auto routing
 *   (manual /model or model-cycle switches turn routing off)
 *   classifier <name>                 switch active classifier (saved)
 *   classifier list|add|remove        manage classifier profiles
 *   conf <x> [classifier=n]           per-classifier global confidence gate
 *   streak <n> [classifier=n]         per-classifier global hysteresis
 *   timeout <ms> [classifier=n]       per-classifier classification timeout
 *   route add|set|remove <name> ...   routing table (shared across classifiers)
 *   (no args)                         status panel
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface RouteTier {
  model: string; // "provider/modelId" (OpenRouter-style id used by pi)
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  /** Override global hysteresis (consecutive agreeing turns) for this route */
  hysteresisTurns?: number;
}

/** One classifier backend (a System One endpoint + its threshold profile). */
interface ClassifierProfile {
  /** Base URL; the client POSTs to `${baseUrl}/systemone`. */
  baseUrl: string;
  /** Env var holding the API key. Not required when baseUrl is localhost. */
  apiKeyEnv?: string;
  /** Value of the "model" field sent in the request body. */
  model: string;
  /** Classification timeout; late answers are discarded (fail open). */
  timeoutMs: number;
  /** Global confidence gate for this classifier's scale. */
  minConfidence: number;
  /** Confidence gate for explicit "switch this session's model" directives (same scale). */
  dirConf?: number;
  /** Global hysteresis for this classifier. */
  hysteresisTurns: number;
  /** Per-route confidence gate overrides (this classifier's scale). */
  routeConf?: Record<string, number>;
}

interface Config {
  enabled: boolean;
  /** Key of the active classifier profile. */
  classifier: string;
  classifiers: Record<string, ClassifierProfile>;
  routes: Record<string, RouteTier>;
  historyTurns: number;
  userMsgClipChars: number;
  /** When true, pop up a confirmation dialog before each routed model switch. */
  confirmSwitch: boolean;
  /** After a declined switch, this many turns must pass before re-prompting for the same task. */
  cooloffTurns: number;
}

const DEFAULTS: Config = {
  enabled: true,
  classifier: "jev",
  classifiers: {
    jev: {
      baseUrl: "https://api.typesafe.ai/v1",
      apiKeyEnv: "JEV_API_KEY",
      model: "jev-latest",
      timeoutMs: 1500,
      minConfidence: 0.98,
      dirConf: 0.95,
      hysteresisTurns: 2,
      routeConf: { chat: 0.98, coding: 0.95, testing: 0.95, review: 0.98, debugging: 0.9, design: 0.85 },
    },
    kev: {
      // Local llama.cpp decision model (Kev-4B GGUF). Calibration temperature 2.406
      // flattens probabilities, so the confidence scale differs from Jev — hence a
      // separate threshold profile. 0.30 is a placeholder pending eval calibration.
      baseUrl: "http://127.0.0.1:8080/v1",
      apiKeyEnv: undefined,
      model: "kev-latest",
      timeoutMs: 500,
      minConfidence: 0.3,
      dirConf: 0.5,
      hysteresisTurns: 2,
    },
  },
  routes: {
    chat: { model: "openrouter/z-ai/glm-5.3-flash", thinkingLevel: "low" },
    coding: { model: "openrouter/deepseek/deepseek-v4.1-flash", thinkingLevel: "low" },
    testing: { model: "openrouter/deepseek/deepseek-v4.1-flash", thinkingLevel: "low" },
    review: { model: "openrouter/openai/gpt-5.6-luna", thinkingLevel: "medium" },
    debugging: { model: "openrouter/z-ai/glm-5.3", thinkingLevel: "medium", hysteresisTurns: 1 },
    design: { model: "openrouter/anthropic/claude-opus-5.5", thinkingLevel: "high", hysteresisTurns: 1 },
  },
  historyTurns: 10,
  userMsgClipChars: 200,
  confirmSwitch: false,
  cooloffTurns: 5,
};

function isLocalBaseUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);
}

function activeProfile(cfg: Config): ClassifierProfile {
  return cfg.classifiers[cfg.classifier] ?? cfg.classifiers.jev;
}

function loadConfig(): Config {
  const cfg = structuredClone(DEFAULTS);
  try {
    const raw = JSON.parse(readFileSync(join(homedir(), ".pi", "agent", "settings.json"), "utf8"));
    const user = raw?.modelRouter;
    if (user) {
      cfg.enabled = user.enabled ?? cfg.enabled;
      cfg.classifier = user.classifier ?? cfg.classifier;
      cfg.historyTurns = user.historyTurns ?? cfg.historyTurns;
      cfg.userMsgClipChars = user.userMsgClipChars ?? cfg.userMsgClipChars;
      if (typeof user.confirmSwitch === "boolean") cfg.confirmSwitch = user.confirmSwitch;
      if (typeof user.cooloffTurns === "number" && Number.isInteger(user.cooloffTurns) && user.cooloffTurns >= 0)
        cfg.cooloffTurns = user.cooloffTurns;
      for (const [name, p] of Object.entries(user.classifiers ?? {})) {
        const existing = cfg.classifiers[name] ?? {} as ClassifierProfile;
        cfg.classifiers[name] = { ...existing, ...(p as object) } as ClassifierProfile;
      }
      cfg.routes = { ...cfg.routes, ...(user.routes ?? {}) };
    } else if (raw?.jevRouter) {
      // Legacy jevRouter migration: global fields + routes; per-route minConfidence
      // values move into the jev profile's routeConf.
      const legacy = raw.jevRouter;
      cfg.enabled = legacy.enabled ?? cfg.enabled;
      cfg.historyTurns = legacy.historyTurns ?? cfg.historyTurns;
      cfg.userMsgClipChars = legacy.userMsgClipChars ?? cfg.userMsgClipChars;
      const jev = cfg.classifiers.jev;
      if (legacy.minConfidence !== undefined) jev.minConfidence = legacy.minConfidence;
      if (legacy.hysteresisTurns !== undefined) jev.hysteresisTurns = legacy.hysteresisTurns;
      if (legacy.timeoutMs !== undefined) jev.timeoutMs = legacy.timeoutMs;
      if (legacy.baseUrl !== undefined) jev.baseUrl = legacy.baseUrl;
      cfg.routes = { ...cfg.routes, ...(legacy.routes ?? {}) };
      for (const [name, tier] of Object.entries(cfg.routes) as [string, RouteTier & { minConfidence?: number }][]) {
        if (tier.minConfidence !== undefined) {
          (jev.routeConf ??= {})[name] = tier.minConfidence;
          delete tier.minConfidence;
        }
      }
      cfg.classifier = "jev";
    }
  } catch {
    /* defaults */
  }
  if (!cfg.classifiers[cfg.classifier]) cfg.classifier = "jev";
  return cfg;
}

/** Persist config to settings.json under modelRouter (preserving other keys). */
function saveConfig(cfg: Config): string | null {
  try {
    const path = join(homedir(), ".pi", "agent", "settings.json");
    const raw = JSON.parse(readFileSync(path, "utf8"));
    // NOTE: `enabled` is deliberately NOT persisted — the on/off toggle is session-only,
    // so a session toggle followed by any other config save must not freeze it into settings.json.
    raw.modelRouter = {
      ...(raw.modelRouter ?? {}),
      classifier: cfg.classifier,
      classifiers: cfg.classifiers,
      routes: cfg.routes,
      historyTurns: cfg.historyTurns,
      userMsgClipChars: cfg.userMsgClipChars,
      confirmSwitch: cfg.confirmSwitch,
      cooloffTurns: cfg.cooloffTurns,
    };
    writeFileSync(path, JSON.stringify(raw, null, 2) + "\n");
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Parse "key=value" tokens into a record. Values may be quoted. */
function parseKv(tokens: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tokens) {
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    out[t.slice(0, eq).toLowerCase()] = t.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return out;
}

const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

/** Validate and normalize route-tier tokens. Returns [error, patch]. */
function routePatch(kv: Record<string, string>): [string | null, Partial<RouteTier> & { criteria?: string; conf?: number }] {
  const patch: Partial<RouteTier> & { criteria?: string; conf?: number } = {};
  if (kv.model) patch.model = kv.model;
  if (kv.think !== undefined) {
    if (!THINKING_LEVELS.has(kv.think)) return [`think must be one of: ${[...THINKING_LEVELS].join(" ")}`, patch];
    patch.thinkingLevel = kv.think as RouteTier["thinkingLevel"];
  }
  if (kv.conf !== undefined) {
    const v = Number(kv.conf);
    if (!(v >= 0 && v <= 1)) return ["conf must be between 0 and 1", patch];
    patch.conf = v; // stored per active classifier via routeConf by the caller
  }
  if (kv.streak !== undefined) {
    const v = Number(kv.streak);
    if (!(Number.isInteger(v) && v >= 1)) return ["streak must be an integer ≥ 1", patch];
    patch.hysteresisTurns = v;
  }
  if (kv.criteria !== undefined) patch.criteria = kv.criteria;
  return [null, patch];
}

// ---------------------------------------------------------------------------
// State digest — compact summary of recent conversation for the classifier
// ---------------------------------------------------------------------------

interface StateDigest {
  turn: number;
  recent_user_messages: string[];
  recent_assistant_actions: string[];
  activity: {
    tools_last_turn: string[];
    files_touched: string[];
    errors_last_turn: boolean;
  };
  current_prompt: string;
}

function clip(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (c?.type === "text" ? c.text : c?.type === "image" ? "[image]" : ""))
      .join(" ");
  }
  return "";
}

function buildDigest(ctx: ExtensionContext, prompt: string, cfg: Config): StateDigest {
  const userMsgs: string[] = [];
  const actions: string[] = [];
  const tools = new Set<string>();
  const files = new Set<string>();
  let lastTurnErrors = false;

  let entries: any[];
  try {
    entries = ctx.sessionManager.getBranch();
  } catch {
    entries = ctx.sessionManager.getEntries();
  }

  const messages = entries
    .filter((e: any) => e.type === "message" && e.message)
    .map((e: any) => e.message);
  // "Last turn" = everything after the most recent user message (the prompt being
  // classified is not yet in the branch when this runs).
  const lastUserIdx = messages.findLastIndex((m: any) => m.role === "user");

  messages.forEach((m: any, i: number) => {
    const inLastTurn = i > lastUserIdx;
    if (m.role === "user") {
      userMsgs.push(clip(textOf(m.content), cfg.userMsgClipChars));
    } else if (m.role === "assistant") {
      for (const c of Array.isArray(m.content) ? m.content : []) {
        if (c?.type !== "toolCall") continue;
        const name = c.name ?? c.toolName ?? "?";
        // Extract file-ish arguments for edit/read/write-style tools
        const inp = c.input ?? c.arguments ?? {};
        if (inLastTurn) tools.add(name);
        actions.push(clip(`${name} ${JSON.stringify(inp)}`, 80));
        for (const key of ["path", "file_path", "file"]) {
          if (typeof inp?.[key] === "string") files.add(inp[key]);
        }
        if (typeof inp?.command === "string" && inp.command.length < 120) {
          if (inLastTurn) tools.add(`bash(${clip(inp.command, 60)})`);
          actions.push(clip(`bash ${inp.command}`, 80));
        }
      }
    } else if (m.role === "toolResult") {
      if (m.isError) {
        if (inLastTurn) lastTurnErrors = true;
        actions.push("tool error");
      }
    }
  });

  const recent = userMsgs.slice(-cfg.historyTurns);

  return {
    turn: recent.length,
    recent_user_messages: recent,
    recent_assistant_actions: actions.slice(-12),
    activity: {
      tools_last_turn: [...new Set(tools)].slice(0, 8),
      files_touched: [...files].slice(0, 8),
      errors_last_turn: lastTurnErrors,
    },
    current_prompt: clip(prompt, 1000),
  };
}

// ---------------------------------------------------------------------------
// System One client — POST {baseUrl}/systemone with the question battery.
// ---------------------------------------------------------------------------

const TASK_TYPES = ["chat", "coding", "testing", "review", "debugging", "design"];

const QUESTIONS = {
  task: {
    type: "choice",
    instructions:
      "Which task type best fits this agent conversation state and current prompt?",
    criteria: {
      chat: "Casual conversation, factual question, or follow-up chatter not requiring code changes",
      coding: "Writing, editing, or refactoring code",
      testing: "Writing or running tests",
      review: "Reviewing existing code or recent changes for problems",
      debugging: "Diagnosing failures, errors, or unexpected behavior",
      design: "Architecture or high-level design work",
    } as Record<string, string>, // mutable: route add criteria=... extends the taxonomy at runtime
  },
  complexity: {
    type: "score",
    instructions: "How cognitively complex is the current request?",
    criteria: [
      "trivial chat or lookup",
      "simple well-scoped change",
      "moderate multi-step work",
      "hard debugging or cross-cutting change",
      "architecture-level design",
    ],
  },
  risky: {
    type: "noul",
    instructions:
      "Does the current prompt plausibly request a destructive or risky operation?",
  },
  model_switch: {
    type: "choice",
    instructions:
      "Does the current prompt explicitly instruct that THIS agent session should switch its own active model now? " +
      "Merely mentioning a model for another purpose (e.g. telling subagents which model to use, comparing models, or asking to switch later) is NOT a switch request.",
    criteria: {
      none: "No instruction to change this session's active model",
      switch_now: "Explicitly asks this session to switch its own model immediately",
    },
  },
} as const;

const SWITCH_CHOICES = new Set(["none", "switch_now"]);

interface ClassifyResult {
  task: string;
  probs: Record<string, number>;
  complexity: number;
  risky: boolean;
  confidence: number;
  /** Answer to the model_switch question: "none" | "switch_now". */
  switchReq: string;
  /** Confidence of the model_switch answer (active classifier's scale). */
  switchConf: number;
}

async function classify(
  state: StateDigest,
  profile: ClassifierProfile,
  signal: AbortSignal,
): Promise<ClassifyResult | null> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Local endpoints need no auth; cloud profiles take the key from their env var.
  if (!isLocalBaseUrl(profile.baseUrl) && profile.apiKeyEnv) {
    const apiKey = process.env[profile.apiKeyEnv];
    if (!apiKey) return null;
    headers.authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${profile.baseUrl}/systemone`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: profile.model, state, questions: QUESTIONS }),
    signal,
  });
  if (!res.ok) return null;

  const json: any = await res.json();
  const answers = json?.answers;
  const task = answers?.task;
  const probs: Record<string, number> | undefined = task?.probabilities;
  if (task?.type !== "choice" || typeof task?.choice !== "string" || !probs) return null;

  return {
    // API returns a chance-corrected confidence (0..1) per answer — use theirs directly.
    // NOTE: scales differ per classifier (Jev sharp, Kev flattened at T≈2.4);
    // thresholds are per-classifier for that reason.
    task: TASK_TYPES.includes(task.choice) ? task.choice : "chat",
    probs,
    complexity: typeof answers?.complexity?.score === "number" ? answers.complexity.score : 0,
    risky: typeof answers?.risky?.noul === "number" ? answers.risky.noul >= 0.5 : false,
    confidence: typeof task.confidence === "number" ? task.confidence : 0,
    switchReq:
      answers?.model_switch?.type === "choice" &&
      typeof answers.model_switch.choice === "string" &&
      SWITCH_CHOICES.has(answers.model_switch.choice)
        ? answers.model_switch.choice
        : "none",
    switchConf:
      answers?.model_switch?.type === "choice" && typeof answers.model_switch.confidence === "number"
        ? answers.model_switch.confidence
        : 0,
  };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function activate(pi: ExtensionAPI) {
  const cfg = loadConfig();

  let lastClassification: (StateDigest & { result: ClassifyResult }) | null = null;
  let pendingType: string | null = null; // hysteresis memory
  let lastStatus = "idle";
  /** Cooloff after a declined switch: task type + turns remaining before we re-prompt. */
  let declinedTask: string | null = null;
  let cooloffRemaining = 0;
  /** Model the user explicitly pinned this session to; suppresses auto routing until released. */
  let pinnedModel: string | null = null;

  const PIN_ENTRY = "pi.model-router.pin";

  function setStatus(ctx: ExtensionContext, text: string) {
    lastStatus = text;
    ctx.ui.setStatus("routing", text);
  }

  function setPin(ctx: ExtensionContext, modelId: string) {
    pinnedModel = modelId;
    pendingType = null;
    try {
      pi.appendEntry(PIN_ENTRY, { modelId }); // best-effort persistence across restarts
    } catch {
      /* pin stays in memory */
    }
  }

  function disableRouting(ctx: ExtensionContext, why: string) {
    cfg.enabled = false;
    pendingType = null;
    setStatus(ctx, `disabled (${why})`);
    ctx.ui.notify(`model-routing off — ${why}; re-enable with /model-routing on`, "info");
  }

  /** Shared switch-confirmation dialog. "keep" on dismissal or when there is no UI. */
  async function confirmSwitchDialog(
    ctx: ExtensionContext,
    currentId: string,
    targetId: string,
    why: string,
  ): Promise<"switch" | "keep" | "disable"> {
    if (!ctx.hasUI) return "keep";
    const pick = await ctx.ui.select(
      `🔀 Model router wants to switch (${why})\n  ${currentId} → ${targetId}\n\nSwitch models?`,
      [
        `Switch to ${targetId}`,
        `Keep ${currentId} (this turn)`,
        `Keep ${currentId} and disable routing`,
      ],
    );
    if (pick === undefined) return "keep"; // dismissed (escape)
    if (pick.startsWith("Switch")) return "switch";
    if (pick.includes("disable routing")) return "disable";
    return "keep";
  }

  /**
   * Resolve a model named in the prompt against the catalog. The classifier decides *whether*
   * the user is requesting a switch; this decides *which* model. Returns the full
   * "provider/modelId", or null + reason when nothing/ambiguous.
   */
  function resolveTargetModel(prompt: string, ctx: ExtensionContext): { id: string | null; reason?: string } {
    const hay = prompt.toLowerCase();
    const candidates: { token: string; full: string }[] = [];
    try {
      for (const m of ctx.modelRegistry.getAvailable()) {
        const full = `${m.provider}/${m.id}`;
        const tokens = new Set([full.toLowerCase(), m.id.toLowerCase()]);
        if (m.name) tokens.add(m.name.toLowerCase());
        for (const t of tokens) {
          if (t.length >= 4 && hay.includes(t)) candidates.push({ token: t, full });
        }
      }
    } catch {
      return { id: null, reason: "model catalog unavailable" };
    }
    if (!candidates.length) return { id: null, reason: "no catalog model named in the prompt" };
    // Drop candidates whose token is a substring of another match (e.g. "glm-5.3" ⊂ "glm-5.3-flash").
    const tokens = candidates.map((c) => c.token);
    const maximal = candidates.filter((c) => !tokens.some((t) => t !== c.token && t.includes(c.token)));
    const ids = new Set(maximal.map((c) => c.full));
    if (ids.size > 1) return { id: null, reason: `ambiguous model reference (${[...ids].join(", ")})` };
    return { id: maximal[0].full };
  }

  pi.on("before_agent_start", async (event, ctx) => {
    if (!cfg.enabled) return;
    // Cooloff ticks once per user turn, regardless of how classification goes.
    const coolingThisTurn = cooloffRemaining > 0;
    if (coolingThisTurn) cooloffRemaining--;
    const profile = activeProfile(cfg);
    const needsKey = !isLocalBaseUrl(profile.baseUrl) && profile.apiKeyEnv;
    if (needsKey && !process.env[profile.apiKeyEnv!]) {
      setStatus(ctx, `no ${profile.apiKeyEnv} — routing disabled`);
      return;
    }

    const state = buildDigest(ctx, event.prompt, cfg);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), profile.timeoutMs);

    let result: ClassifyResult | null = null;
    try {
      result = await classify(state, profile, controller.signal);
    } catch {
      result = null; // network/abort/etc.
    } finally {
      clearTimeout(timer);
    }

    if (!result) {
      // Fail open, drop late/failed results entirely. Keep current model.
      setStatus(ctx, `timeout/err — kept ${ctx.model?.id ?? "?"}`);
      return;
    }

    lastClassification = { ...state, result };

    const current = ctx.model;
    const currentId = current ? `${current.provider}/${current.id}` : "?";

    // --- explicit directives: the user asked THIS session to switch its own model ---
    const dirNeedConf = profile.dirConf ?? profile.minConfidence;
    if (result.switchReq !== "none" && result.switchConf >= dirNeedConf) {
      const resolved = resolveTargetModel(event.prompt, ctx);
      if (!resolved.id) {
        setStatus(
          ctx,
          `switch request (${result.switchReq}, conf ${result.switchConf.toFixed(2)} ≥ ${dirNeedConf}) but ${resolved.reason} — routing normally`,
        );
      } else if (resolved.id === currentId) {
        setStatus(ctx, `switch request but already on ${currentId}`);
      } else {
        const [dp, ...drest] = resolved.id.split("/");
        const dmodel = ctx.modelRegistry.find(dp, drest.join("/"));
        if (!dmodel) {
          setStatus(ctx, `switch request target ${resolved.id} not in catalog — routing normally`);
        } else {
          // ALWAYS confirmed — the classifier is interpreting the user's words, so the
          // gate belongs exactly here, regardless of confirmSwitch.
          const decision = await confirmSwitchDialog(
            ctx,
            currentId,
            resolved.id,
            `explicit request, conf ${result.switchConf.toFixed(2)} ≥ ${dirNeedConf}`,
          );
          if (decision === "switch") {
            suppressManualSelectOnce = true;
            const ok = await pi.setModel(dmodel);
            suppressManualSelectOnce = false;
            if (ok) {
              setPin(ctx, resolved.id);
              setStatus(ctx, `switched to ${resolved.id} (explicit request — pinned, auto routing suppressed)`);
            } else {
              setStatus(ctx, `no credentials for ${resolved.id} — kept ${currentId}`);
            }
          } else if (decision === "disable") {
            disableRouting(ctx, `declined explicit switch to ${resolved.id}`);
          } else {
            setStatus(ctx, `declined explicit switch to ${resolved.id} — kept ${currentId}`);
          }
          return;
        }
      }
    }

    // --- pin: an explicitly chosen model overrides auto routing until released ---
    if (pinnedModel) {
      pendingType = null;
      setStatus(ctx, `pinned to ${pinnedModel} — auto routing suppressed (/model-routing unpin to release)`);
      return;
    }

    const tier = cfg.routes[result.task];
    const targetId = tier?.model;

    if (!targetId) {
      setStatus(ctx, `no route for "${result.task}" — kept ${currentId}`);
      return;
    }

    if (targetId === currentId) {
      pendingType = result.task;
      setStatus(ctx, `${result.task} → ${targetId} (already active)`);
      return;
    }

    // Switch gate: confidence + hysteresis, per-route overrides over the
    // active classifier's defaults (each classifier has its own scale).
    const needConf = profile.routeConf?.[result.task] ?? profile.minConfidence;
    const needStreak = tier.hysteresisTurns ?? profile.hysteresisTurns;
    const confident = result.confidence >= needConf;
    const stable = pendingType === result.task;
    pendingType = result.task;

    if (!confident || !stable) {
      setStatus(
        ctx,
        `${result.task} (${result.confidence.toFixed(2)}) — kept ${currentId}` +
          (confident ? ` [needs ${needStreak} turns]` : " [low conf]"),
      );
      return;
    }

    // Resolve target model in the registry; degrade gracefully if unavailable
    const [provider, ...rest] = targetId.split("/");
    const model = ctx.modelRegistry.find(provider, rest.join("/"));
    if (!model) {
      setStatus(ctx, `route "${targetId}" not found — kept ${currentId}`);
      return;
    }
    // Cooloff: don't re-prompt for the same task the user just declined.
    if (result.task === declinedTask && coolingThisTurn) {
      setStatus(
        ctx,
        `${result.task} → ${targetId} — kept ${currentId} [declined; ${cooloffRemaining === 0 ? "cooloff ends next turn" : `cooloff ${cooloffRemaining} more turn${cooloffRemaining === 1 ? "" : "s"}`}]`,
      );
      return;
    }
    declinedTask = null;

    // Optional confirmation popup (stolen from injection-guard's review dialog).
    if (cfg.confirmSwitch) {
      const decision = await confirmSwitchDialog(
        ctx,
        currentId,
        targetId,
        `${result.task}, conf ${result.confidence.toFixed(2)} ≥ ${needConf}`,
      );
      if (decision === "disable") {
        disableRouting(ctx, `declined switch to ${targetId}`); // session-only, never persisted
        return;
      }
      if (decision === "keep") {
        declinedTask = result.task;
        cooloffRemaining = cfg.cooloffTurns;
        setStatus(ctx, `declined ${result.task} → ${targetId} — kept ${currentId} [cooloff ${cfg.cooloffTurns} turns]`);
        return;
      }
    }
    suppressManualSelectOnce = true; // our own switch must not disable routing
    const ok = await pi.setModel(model);
    suppressManualSelectOnce = false; // handler ran during the await; clear defensively anyway
    if (!ok) {
      setStatus(ctx, `no credentials for ${targetId} — kept ${currentId}`);
      return;
    }
    if (tier.thinkingLevel) {
      try {
        pi.setThinkingLevel(tier.thinkingLevel);
      } catch {
        /* level clamped/unavailable — non-fatal */
      }
    }
    setStatus(ctx, `${result.task} → ${targetId} (conf ${result.confidence.toFixed(2)} ≥ ${needConf})`);
  });

  // Manual model selection disables auto routing for the session. The router's
  // own switches also arrive here as source "set", so they are guarded by a
  // flag set around pi.setModel(). "restore" (session startup) never disables.
  let suppressManualSelectOnce = false;
  pi.on("model_select", async (event, ctx) => {
    if (suppressManualSelectOnce) {
      suppressManualSelectOnce = false;
      return;
    }
    if (event.source === "restore") return;
    if (!cfg.enabled) return;
    cfg.enabled = false;
    pinnedModel = null; // a manual pick supersedes any pin
    pendingType = null; // reset hysteresis across the boundary
    setStatus(ctx, "disabled (manual model switch)");
    ctx.ui.notify(
      `model-routing off — you picked ${event.model.provider}/${event.model.id} manually; re-enable with /model-routing on`,
      "info",
    );
  });

  // Restore pin persisted on the session branch (survives restarts).
  pi.on("session_start", async (_event, ctx) => {
    try {
      const branch = ctx.sessionManager.getBranch() as any[];
      for (const e of branch) {
        if (e?.type !== "custom") continue;
        if (e.customType === PIN_ENTRY && typeof e.data?.modelId === "string") pinnedModel = e.data.modelId;
      }
      if (pinnedModel) setStatus(ctx, `restored pin: ${pinnedModel} (auto routing suppressed)`);
    } catch {
      /* best-effort */
    }
  });

  const routingCommand = async (args: string, ctx: ExtensionContext) => {
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      const err = (m: string) => ctx.ui.notify(m, "error");
      const info = (m: string) => ctx.ui.notify(m, "info");

      // --- on / off: session-only toggle ---
      const arg0 = tokens[0]?.toLowerCase();
      if (arg0 === "on" || arg0 === "off") {
        const enabling = arg0 === "on";
        if (cfg.enabled === enabling) {
          info(`model-routing already ${arg0}`);
        } else {
          cfg.enabled = enabling;
          pendingType = null; // reset hysteresis across the boundary
          setStatus(ctx, enabling ? "enabled (manual)" : "disabled (manual)");
          info(`model-routing ${enabling ? "enabled" : "disabled"} — auto routing ${enabling ? "on" : "off"} for this session`);
        }
        return;
      }

      // --- classifier switching & profile management ---
      if (arg0 === "classifier" || arg0 === "cls") {
        const sub = tokens[1]?.toLowerCase();
        if (!sub || sub === "list") {
          info(
            `classifiers (active: ${cfg.classifier}):\n` +
              Object.entries(cfg.classifiers)
                .map(([name, p]) => {
                  const local = isLocalBaseUrl(p.baseUrl) ? " [local]" : "";
                  return `  ${name === cfg.classifier ? "▸" : " "} ${name.padEnd(10)} ${p.baseUrl}${local}  model=${p.model}  conf≥${p.minConfidence}  streak≥${p.hysteresisTurns}  timeout=${p.timeoutMs}ms`;
                })
                .join("\n"),
          );
          return;
        }
        if (sub === "add") {
          const name = tokens[2]?.toLowerCase();
          if (!name) {
            err("usage: /model-routing classifier add <name> baseUrl=<url> [model=m] [conf=x] [streak=n] [timeout=ms] [keyEnv=VAR]");
            return;
          }
          if (name in cfg.classifiers) {
            err(`classifier "${name}" already exists — edit settings.json or remove it first`);
            return;
          }
          const kv = parseKv(tokens.slice(3));
          if (!kv.baseurl && !kv.url) {
            err("baseUrl=<url> is required\nexample: /model-routing classifier add laya url=http://127.0.0.1:8080/v1 model=laya-latest conf=0.3");
            return;
          }
          cfg.classifiers[name] = {
            baseUrl: kv.baseurl ?? kv.url!,
            apiKeyEnv: kv.keyenv || undefined,
            model: kv.model ?? "default",
            timeoutMs: Number(kv.timeout) || 500,
            minConfidence: kv.conf !== undefined && !Number.isNaN(Number(kv.conf)) ? Number(kv.conf) : 0.5,
            dirConf: kv.dirconf !== undefined && !Number.isNaN(Number(kv.dirconf)) ? Number(kv.dirconf) : undefined,
            hysteresisTurns: Number(kv.streak) || 2,
          };
          pendingType = null;
          const e = saveConfig(cfg);
          info(`classifier "${name}" added${e ? ` — FAILED to save: ${e}` : " — saved"}\nswitch to it with: /model-routing classifier ${name}`);
          return;
        }
        if (sub === "remove" || sub === "rm") {
          const name = tokens[2]?.toLowerCase();
          if (!name || !(name in cfg.classifiers)) {
            err(`usage: /model-routing classifier remove <name> (have: ${Object.keys(cfg.classifiers).join(", ")})`);
            return;
          }
          if (name === cfg.classifier) {
            err(`"${name}" is the active classifier — switch first`);
            return;
          }
          delete cfg.classifiers[name];
          const e = saveConfig(cfg);
          info(`classifier "${name}" removed${e ? ` — FAILED to save: ${e}` : " — saved"}`);
          return;
        }
        // switch active
        const name = sub;
        if (!cfg.classifiers[name]) {
          info(`no classifier "${name}" (have: ${Object.keys(cfg.classifiers).join(", ")})`);
          return;
        }
        if (name !== cfg.classifier) {
          cfg.classifier = name;
          pendingType = null; // confidence scales differ; hysteresis doesn't carry across
          const e = saveConfig(cfg);
          setStatus(ctx, `classifier: ${name}`);
          info(`active classifier → ${name}${e ? ` — FAILED to save: ${e}` : " — saved"} (hysteresis reset)`);
        } else {
          info(`already using ${name}`);
        }
        return;
      }

      // --- pin / unpin: explicit model pin overrides auto routing ---
      if (arg0 === "pin" || arg0 === "unpin") {
        if (arg0 === "unpin") {
          if (!pinnedModel) {
            info("no pin to release");
            return;
          }
          pinnedModel = null;
          setStatus(ctx, "pin released — auto routing active");
          info("pin released — auto routing active again");
          return;
        }
        const target = tokens[1];
        if (!target) {
          info(pinnedModel ? `pinned to ${pinnedModel}` : "no pin (auto routing active)");
          return;
        }
        const [p2, ...r2] = target.split("/");
        const m = ctx.modelRegistry.find(p2, r2.join("/"));
        if (!m) {
          err(`no model "${target}" in the catalog`);
          return;
        }
        const full = `${m.provider}/${m.id}`;
        setPin(ctx, full);
        setStatus(ctx, `pinned to ${full}`);
        info(`pinned to ${full} — auto routing suppressed until /model-routing unpin or an explicit switch request in a prompt`);
        return;
      }

      // --- confirm on|off: pop up before routed switches ---
      if (arg0 === "confirm") {
        const sub = tokens[1]?.toLowerCase();
        if (sub !== "on" && sub !== "off") {
          err(`usage: /model-routing confirm on|off  (currently ${cfg.confirmSwitch ? "on" : "off"})`);
          return;
        }
        cfg.confirmSwitch = sub === "on";
        const e = saveConfig(cfg);
        setStatus(ctx, `confirm switch: ${sub} (saved)`);
        info(
          `switch confirmation ${cfg.confirmSwitch ? "ON" : "OFF"} — routed switches will ${cfg.confirmSwitch ? "pop up a confirm dialog" : "happen silently"}${e ? ` — FAILED to save: ${e}` : " — saved to settings.json"}`,
        );
        return;
      }

      // --- cooloff: turns to wait after a declined switch before re-prompting ---
      if (arg0 === "cooloff") {
        const v = Number(tokens[1]);
        if (!tokens[1] || Number.isNaN(v) || !(Number.isInteger(v) && v >= 0)) {
          err(`usage: /model-routing cooloff <turns≥0>  (currently ${cfg.cooloffTurns})`);
          return;
        }
        cfg.cooloffTurns = v;
        const e = saveConfig(cfg);
        setStatus(ctx, `cooloff = ${v} turns (saved)`);
        info(
          `switch-confirm cooloff = ${v} turn${v === 1 ? "" : "s"} — after you decline a switch, the router waits this long before re-prompting for the same task${e ? ` — FAILED to save: ${e}` : " — saved to settings.json"}`,
        );
        return;
      }

      // --- per-classifier global knobs: conf | streak | timeout ---
      if (arg0 === "conf" || arg0 === "streak" || arg0 === "timeout") {
        const kv = parseKv(tokens.slice(1));
        const targetName = kv.classifier ?? kv.cls;
        const profile = targetName ? cfg.classifiers[targetName] : activeProfile(cfg);
        if (!profile) {
          err(`no classifier "${targetName}" (have: ${Object.keys(cfg.classifiers).join(", ")})`);
          return;
        }
        const v = Number(tokens[1]);
        if (!tokens[1] || Number.isNaN(v)) {
          err(`usage: /model-routing ${arg0} <${arg0 === "conf" ? "0..1" : arg0 === "streak" ? "integer ≥ 1" : "ms"}> [classifier=<name>]`);
          return;
        }
        if (arg0 === "conf" && !(v >= 0 && v <= 1)) {
          err("conf must be between 0 and 1");
          return;
        }
        if (arg0 === "streak" && !(Number.isInteger(v) && v >= 1)) {
          err("streak must be an integer ≥ 1");
          return;
        }
        if (arg0 === "timeout" && !(Number.isInteger(v) && v >= 100)) {
          err("timeout must be ≥ 100 ms");
          return;
        }
        if (arg0 === "conf") profile.minConfidence = v;
        else if (arg0 === "streak") profile.hysteresisTurns = v;
        else profile.timeoutMs = v;
        pendingType = null;
        const e = saveConfig(cfg);
        setStatus(ctx, `${cfg.classifier}.${arg0}=${v} (saved)`);
        info(`classifier "${targetName ?? cfg.classifier}" ${arg0}=${v}${e ? ` — FAILED to save: ${e}` : " — saved to settings.json"}`);
        return;
      }

      // --- route management (shared routing table) ---
      if (arg0 === "route") {
        const sub = tokens[1];
        const profile = activeProfile(cfg);
        if (sub === "add" || sub === "set") {
          const name = tokens[2]?.toLowerCase();
          if (!name) {
            info(`usage: /model-routing route ${sub} <name> ${sub === "add" ? "<provider/model> " : ""}[key=value ...]\nkeys: model, conf (0..1, stored per active classifier), streak (int ≥ 1), think (${[...THINKING_LEVELS].join("|")})${sub === "add" ? ", criteria (adds to classifier taxonomy)" : ""}`);
            return;
          }
          if (sub === "add") {
            // Model can be positional (the token right after the name, if it has no "=") or model=...
            const rest = tokens.slice(3);
            const positional = rest[0] && !rest[0].includes("=") ? rest[0] : undefined;
            const [perr, patch] = routePatch(parseKv(positional ? rest.slice(1) : rest));
            if (positional) patch.model = patch.model ?? positional;
            if (perr || !patch.model) {
              err(perr ?? "model=<provider/model> is required for route add\nexample: /model-routing route add research openrouter/x/y conf=0.4 streak=1 criteria='Researching papers and docs'");
              return;
            }
            if (name in cfg.routes) {
              info(`route "${name}" already exists — use /model-routing route set ${name} ...`);
              return;
            }
            const { criteria, conf, ...tier } = patch as Partial<RouteTier> & { criteria?: string; conf?: number };
            cfg.routes[name] = tier as RouteTier;
            if (criteria) QUESTIONS.task.criteria[name] = criteria;
            if (conf !== undefined) (profile.routeConf ??= {})[name] = conf;
          } else {
            const tier = cfg.routes[name];
            if (!tier) {
              info(`no route "${name}" (routes: ${Object.keys(cfg.routes).join(", ")})`);
              return;
            }
            const [perr, patch] = routePatch(parseKv(tokens.slice(3)));
            if (perr) {
              err(perr);
              return;
            }
            const { criteria, conf, ...kv } = patch as Partial<RouteTier> & { criteria?: string; conf?: number };
            Object.assign(tier, kv);
            if (criteria) QUESTIONS.task.criteria[name] = criteria;
            if (conf !== undefined) (profile.routeConf ??= {})[name] = conf;
          }
          pendingType = null;
          const e = saveConfig(cfg);
          const t = cfg.routes[name];
          setStatus(ctx, `route ${name} ${sub}d (saved)`);
          info(
            `route "${name}" ${sub === "add" ? "added" : "updated"}${e ? ` — FAILED to save: ${e}` : " — saved"}\n  model: ${t.model}${t.thinkingLevel ? ` think:${t.thinkingLevel}` : ""}\n  conf≥${(profile.routeConf?.[name] ?? profile.minConfidence).toFixed(2)} (${cfg.classifier} scale)  streak≥${t.hysteresisTurns ?? profile.hysteresisTurns}`
          );
          return;
        }
        if (sub === "remove" || sub === "rm") {
          const name = tokens[2]?.toLowerCase();
          if (!name || !(name in cfg.routes)) {
            info(`usage: /model-routing route remove <name> (routes: ${Object.keys(cfg.routes).join(", ")})`);
            return;
          }
          delete cfg.routes[name];
          for (const p of Object.values(cfg.classifiers)) delete p.routeConf?.[name];
          delete QUESTIONS.task.criteria[name];
          pendingType = null;
          const e = saveConfig(cfg);
          setStatus(ctx, `route ${name} removed`);
          info(`route "${name}" removed${e ? ` — FAILED to save: ${e}` : " — saved"}`);
          return;
        }
        info("usage: /model-routing route add|set|remove — see /model-routing for the full panel");
        return;
      }

      if (arg0 === "help" || arg0 === "-h") {
        info(
          `/model-routing — auto model routing (classifier picks task type → route picks model)\n\n` +
            `TOGGLE\n` +
            `  /model-routing on|off        session-only enable/disable (settings.json enabled field\n` +
            `                               untouched); resets hysteresis at the boundary\n\n` +
            `CLASSIFIERS (the task-type classifier backends)\n` +
            `  /model-routing classifier            list classifiers, active marked ▸\n` +
            `  /model-routing classifier <name>     switch active classifier (hysteresis reset —\n` +
            `                                       confidence scales don't carry across)\n` +
            `  /model-routing classifier add <name> baseUrl=<url> [model=m] [conf=x] [streak=n]\n` +
            `                               [timeout=ms] [keyEnv=VAR] — register a classifier\n` +
            `                               backend; conf/streak set its default thresholds\n` +
            `  /model-routing classifier remove <name> — delete (switch away from it first)\n\n` +
            `THRESHOLD KNOBS (per classifier; omit classifier= to target the active one)\n` +
            `  /model-routing conf <0..1> [classifier=<name>]   min confidence to switch routes\n` +
            `  /model-routing streak <int≥1> [classifier=<name>] — hysteresis: task type must\n` +
            `                               persist this many consecutive turns before switching\n` +
            `  /model-routing timeout <ms≥100> [classifier=<name>] — classifier call timeout;\n` +
            `                               on timeout/network/auth failure routing FAILS OPEN\n` +
            `                               (keeps the current model, never blocks)\n\n` +
            `ROUTES (task type → model target)\n` +
            `  /model-routing route add <name> <provider/model> [conf=x] [streak=n]\n` +
            `                               [think=off|minimal|low|medium|high] [criteria='text']\n` +
            `                               — conf/streak stored per active classifier; criteria\n` +
            `                               extends the classifier taxonomy so it can emit this\n` +
            `                               task name\n` +
            `  /model-routing route set <name> key=value ... — update an existing route\n` +
            `  /model-routing route remove <name> — delete route and its taxonomy entry\n\n` +
            `PIN & EXPLICIT SWITCH DIRECTIVES\n` +
            `  /model-routing pin [provider/model]  pin the session to a model — suppresses auto
` +
            `                               routing until /model-routing unpin or an explicit
` +
            `                               switch request in a prompt (e.g. "switch to glm now")
` +
            `  /model-routing unpin         release the pin
` +
            `                               (prompts like "switch to X now" switch immediately,
` +
            `                               user-confirmed; gated per classifier by dirConf)

` +
            `SWITCH CONFIRMATION\n` +
            `  /model-routing confirm on|off  pop up a confirm dialog before each routed\n` +
            `                               model switch (declining keeps the current model;\n` +
            `                               the dialog also offers a disable-routing escape)\n` +
            `  /model-routing cooloff <n>    after a declined switch, don't re-prompt for the\n` +
            `                               same task for this many turns (default 5)\n\n` +
            `OTHER\n` +
            `  /model-routing panel|<no args> — status panel: classifiers, routes, taxonomy,\n` +
            `                               last classification battery (probabilities), status\n` +
            `  /jev                         exact alias for /model-routing\n` +
            `  /model-routing help          this text`,
        );
        return;
      }

      if (arg0 && arg0 !== "panel") {
        info(`unknown subcommand "${arg0}" — /model-routing help for details`);
        return;
      }

      // --- status panel ---
      const profile = activeProfile(cfg);
      const routes = Object.entries(cfg.routes)
        .map(([name, tier]) => {
          const mc = (profile.routeConf?.[name] ?? profile.minConfidence).toFixed(2);
          const hy = String(tier.hysteresisTurns ?? profile.hysteresisTurns);
          const tl = tier.thinkingLevel ? ` · think:${tier.thinkingLevel}` : "";
          return `  ${name.padEnd(10)} ${tier.model}${tl}\n${"".padEnd(14)}conf≥${mc} (${cfg.classifier} scale)  streak≥${hy}`;
        })
        .join("\n");
      const profiles = Object.entries(cfg.classifiers)
        .map(([name, p]) => {
          const local = isLocalBaseUrl(p.baseUrl) ? " [local]" : "";
          return `  ${name === cfg.classifier ? "▸" : " "} ${name.padEnd(10)} ${p.baseUrl}${local}  conf≥${p.minConfidence}  streak≥${p.hysteresisTurns}  timeout=${p.timeoutMs}ms`;
        })
        .join("\n");
      const taxonomy = Object.entries(QUESTIONS.task.criteria)
        .map(([k, v]) => `  ${k.padEnd(10)} ${v}`)
        .join("\n");

      let battery = "(no classification yet this session)";
      if (lastClassification) {
        const c = lastClassification.result;
        const probs = Object.entries(c.probs)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  ${k.padEnd(10)} ${v.toFixed(3)}`)
          .join("\n");
        battery =
          `state.turn=${lastClassification.turn}  state.prompt="${clip(lastClassification.current_prompt, 80)}"\n` +
          `task: ${c.task} (confidence ${c.confidence.toFixed(3)})\n` +
          `complexity: ${c.complexity.toFixed(2)}\n` +
          `risky: ${(c.risky ? 1 : 0)}\n` +
          `probabilities:\n${probs}`;
      }

      ctx.ui.notify(
        `model-routing ${cfg.enabled ? "enabled" : "DISABLED (session toggle)"}  classifier: ${cfg.classifier}  pin: ${pinnedModel ?? "none"}  (/model-routing help for details)\n\n` +
          `classifiers:\n${profiles}\n\n` +
          `routes (thresholds shown on "${cfg.classifier}" scale):\n${routes}\n\n` +
          `task taxonomy:\n${taxonomy}\n\n` +
          `last battery:\n${battery}\n\n` +
          `status: ${lastStatus}`,
        "info",
      );
  };

  pi.registerCommand("model-routing", {
    description: "Model routing: classifiers, thresholds, routes (/model-routing help for details)",
    handler: routingCommand,
  });

  // Backwards-compatible alias: /jev behaves exactly like /model-routing.
  pi.registerCommand("jev", {
    description: "Alias for /model-routing (see /model-routing help)",
    handler: routingCommand,
  });
}
