---
name: ticket-code-review
description: Use when finalizing a ticket, after committing code, to review all commits for a specific ticket ID against the plan and CLAUDE.md conventions
---

# Ticket Code Review

Review all commits for a ticket against its plan and project conventions.

## How to Run

**1. Resolve the commit range for the ticket:**

```bash
# Find the first commit for this ticket (e.g., "feat(045):" or "fix(045):")
FIRST_COMMIT=$(git log --oneline --reverse --grep="(TICKET_ID)" | head -1 | awk '{print $1}')
BASE_SHA="${FIRST_COMMIT}~1"
HEAD_SHA=$(git rev-parse HEAD)
```

If `FIRST_COMMIT` is empty, fall back to the last 5 commits:
```bash
BASE_SHA=$(git rev-parse HEAD~5)
```

**2. Gather context from `.auto-dev/`:**

Read these files (skip any that don't exist):
- `.auto-dev/plan.md` — what was planned
- `.auto-dev/insights.md` — what actually happened, gotchas, decisions
- `.auto-dev/state.json` — ticket ID, title, task count

Ignore `.auto-dev/archive/` — it contains previous runs, not the current ticket.

**3. Dispatch the code-reviewer subagent:**

Use Task tool with `subagent_type: "superpowers:code-reviewer"`. Build the prompt by filling in the template from `ticket-code-review/code-reviewer-prompt.md` — replace ALL placeholders before dispatching. The subagent should receive a complete, ready-to-execute prompt with no unfilled `{PLACEHOLDERS}`.

**4. Act on feedback:**
- **Critical**: Fix immediately, commit with `fix(TICKET_ID): ...`
- **Important**: Fix before finalizing
- **Minor**: Fix or note for future ticket
