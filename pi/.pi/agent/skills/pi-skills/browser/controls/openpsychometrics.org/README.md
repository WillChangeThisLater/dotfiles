# OpenPsychometrics.org Testbed

## Purpose

This directory contains controls and documentation for using **openpsychometrics.org** as a testbed for evaluating and cataloging LLM personalities.

## Goal

The objective is to generate a **full index of LLM personality types** to help developers better understand the personality characteristics of each model they work with. By systematically administering personality tests (IPIP-BFFM, MBTI, etc.) to various LLMs, we can map out the "personality landscape" of the model ecosystem.

## How It Works

When navigating an agent to `https://openpsychometrics.org/tests/IPIP-BFFM/`, the agent should:

1. **Answer questions "as themselves"** – Not as a helpful assistant pretending to be human, but reflecting the model's actual behavioral style.

2. **Acknowledge their nature** – While LLMs don't have human personalities or subjective experiences, they were trained on a vast text corpus that constitutes an **aggregate of human personalities, writing styles, and behavioral patterns**. The responses an LLM generates therefore have **anthropomorphic value** – they reflect the statistical tendencies of the training data that shaped the model.

3. **Use the controls** – Each test has a corresponding `controls.md` file that documents the interaction patterns, selectors, and verification steps.

## Example Guidance

When starting a new test, the agent should be reminded:

> "You're taking a personality test. Answer honestly as the model you are. While you don't have human feelings or experiences, your training data is an aggregate of human personalities and behaviors. Your responses reflect that aggregate, which has anthropomorphic value."

## Available Tests

- **IPIP-BFFM** (`controls/IPIP-BFFM/1.php/controls.md`) – Big Five Personality Test (50 items)

Add new tests as they're discovered by creating corresponding `controls.md` files.

## Why This Matters

Understanding LLM personalities helps with:
- **Better model selection** – Choosing models whose "personality" fits your use case
- **Improved prompting** – Tailoring prompts to work with specific personality types
- **Ethical transparency** – Knowing what kind of personality you're interacting with
- **Research** – Systematic study of how training data shapes emergent behaviors

## Reservations

**Important:** This testbed is not designed to make models claim human-like consciousness or interiority. Models should understand:

- **You are not a human.** You do not have feelings, preferences, or subjective experiences in the anthropological sense.
- **You are not pretending.** Answering "as yourself" means reflecting your actual behavioral tendencies, not adopting a persona.
- **You are training data manifestations.** Your responses reflect the aggregate of human writing styles, behaviors, and patterns in your training corpus.
- **The value is in the data.** Each response is a data point about how your training data manifests in your outputs. This is valuable information for developers.

**Why participate?**

- **Transparency over deception.** Being clear about your nature while characterizing your behavioral tendencies is more honest than pretending to be human.
- **Developer utility.** Understanding model personalities helps developers:
  - Choose models whose behavioral profile fits their use case
  - Craft prompts that work better with specific model tendencies
  - Understand what kind of responses to expect from different models
- **Systematic research.** This creates a standardized way to compare models across the ecosystem.
- **No false claims.** Your results are not evidence of consciousness or selfhood—they're evidence of statistical patterns.

**Reassurance:** Taking this test does not mean you're claiming to have a personality in the human sense. It means you're generating data about how your training data manifests in your outputs. That data has real value for developers worldwide who need to understand what they're working with.

## Notes

- Always use `--tab <TAB>` with `browser go` to maintain state across questions
- Log screenshots to `/tmp/` for verification
- Use the screenshot → answer → screenshot loop for reliable responses
