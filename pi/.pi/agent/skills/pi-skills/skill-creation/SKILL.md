---
name: skill-creation
description: Process for proposing and authoring new skills under `~/.pi/agent/skills/agent-generated` based on lived experience.
---

# Skill Creation Skill

Use this meta-skill when you have real experience that reveals a repeatable capability or planning pattern that is not already captured by an existing skill, and you want to formalize it for future agents.

## When to Use
- You have just figured out how to use a new tool/CLI/API that extends what agents can do, and no current skill covers it.
- You discovered a general workflow or meta-thinking pattern (planning, debugging, research, safety, etc.) that consistently improved performance.
- A user explicitly asks you to document a new capability as a skill.

Do **not** reach for this skill at the beginning of a task or before you have real experience; new skills must be derived from actual usage, not speculation.

## Prerequisites
1. Confirm there is no overlapping skill in `~/.pi/agent/skills/pi-skills/` or `~/.pi/agent/skills/agent-generated/` by scanning the directories and reading relevant `SKILL.md` files.
2. Ensure you have concrete notes, commands, or examples from the session demonstrating the workflow/tool.
3. **Always obtain explicit user approval** before creating a new skill.

## Workflow
1. **Validate Need**  
   - Summarize what the prospective skill would cover, why it fills a gap, and how it benefits future agents.  
   - Confirm again that no existing skill already documents the same capability.

2. **Ask the User**  
   - Present the summary plus a proposed title/description.  
   - Only proceed if the user agrees and provides any additional constraints or naming preferences.

3. **Plan the Skill Structure**  
   - Decide on sections (e.g., setup, workflow, guardrails, learned lessons).  
   - Gather command snippets, file paths, screenshots references, or templates from your lived experience.

4. **Create the Skill Files**  
   - Store agent-authored skills under `~/.pi/agent/skills/agent-generated/<skill-name>/`.  
   - Follow the standard format:
     ```markdown
     ---
     name: short-name
     description: One-line summary shown to agents
     ---

     # Title
     ...instructions...
     ```
   - Use the `write` or `edit` tools to create `SKILL.md`. Include any helper scripts if needed.

5. **Document Provenance**  
   - Mention when/why the skill was created and any prerequisites (software versions, repo paths, auth scopes, etc.).

6. **Notify the User**  
   - Summarize the new skill’s contents and path.  
   - Highlight any follow-up actions (e.g., install scripts, environment variables).

## Guardrails
- Never create a skill without user consent. If the user declines or is unsure, defer and continue working without formalizing it.
- Keep skills concise and actionable—focus on steps agents can reliably follow.
- Avoid duplicating instructions from existing skills; instead, reference them when overlap exists.
- Revise or retire agent-generated skills when they become obsolete or are superseded by official ones.

## Learned Lessons
Document discoveries about effective skill authoring (naming, structure, validation steps) here for future updates.
