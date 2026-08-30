# Global Pi Agent Instructions

## Skill Helper Script Pattern
- Whenever you create helper scripts for a skill, place them under that skill’s `scripts/` subfolder (e.g., `skills/<skill-name>/scripts/`). This isn’t a hard requirement, but it’s the preferred convention so tools stay discoverable.
- Structure `scripts/` with subfolders as needed (per model, scenario, or shared utilities) and include a `README.md` describing how to contribute and discover scripts for that skill.
- Each script should start with a metadata header comment covering purpose, usage, dependencies, and expected working directory. Favor portable shell utilities (`bash`, `curl`, `jq`, etc.) unless a skill explicitly calls for something else.
- Whenever you add or update a script, link to it from the skill’s main documentation (`SKILL.md`, companion logs like `MODEL_LOG.md`, etc.) so future agents know a reusable tool exists.
- Prefer consolidating ad-hoc scripts from `$HOME` or project roots into these skill-specific folders so that automation remains discoverable and versioned alongside the skill.

## Documentation Cascade Reminder
- Use `SKILL.md` for the workflow overview and guardrails.
- Capture model/run-specific notes or benchmarks in companion docs (e.g., `MODEL_LOG.md`).
- Point to reusable automation in the `scripts/` README so other agents can find, run, or extend them without additional context.
- Leave “Lessons Learned”, troubleshooting tips, or run recaps near the bottom of `SKILL.md` (or a linked appendix) so future agents benefit from operational history.

These conventions apply across all projects handled by Pi; follow them whenever you build utilities to support a skill.

## Meta Skill Creation Reminder
- If you uncover a repeatable workflow or tooling pattern that is not yet captured by an existing skill, consider invoking the [`skill-creation` meta-skill](skills/pi-skills/skill-creation/SKILL.md).
- Only promote genuinely novel capabilities: validate that no current skill (official or agent-generated) covers the same ground, then summarize the new idea for the user and request permission to formalize it.
- When the user approves, follow the `skill-creation` instructions to document the workflow under `~/.pi/agent/skills/agent-generated/`, link any helper scripts, and record provenance so future agents know why it exists.
- Even if you ultimately decide not to create a new skill, briefly note discoveries or open questions in the originating `SKILL.md` to guide future agents.

## Media capabilities

Models have varying input media support — some process images, some audio, some video, many only text. Media attachments reach you as <file> tags in messages: the harness only delivers media the current model supports, so **if an attachment reaches you, you can process it** — analyze the content directly. The user knows what media types the current model can process: if they tell you that you can process images/audio/video, assume you can. Never use tools (bash, ffprobe, reading the file, etc.) to "inspect" attached media — its content is delivered to you directly, and reading the raw file bytes is useless.
