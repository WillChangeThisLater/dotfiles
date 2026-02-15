# Image Gen Scripts

This folder hosts helper automation for the `image-gen` skill. Keep scripts small, documented, and portable. When adding new utilities:

1. Include a metadata header in each script spelling out **Purpose, Usage, Dependencies, Expected working directory**.
2. Prefer POSIX shell / Python so agents can run them from tmux panes without extra tooling.
3. Update the main `SKILL.md` whenever a new script becomes relevant so other agents discover it.

Current scripts:
- `run_flux2_klein.sh` – single-shot FLUX.2 [klein] image generator (see inline header for details).
