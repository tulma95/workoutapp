# Ticket System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/ticket` Claude Code skill backed by a TypeScript CLI script for managing the feature backlog.

**Architecture:** `scripts/ticket.ts` is a Node CLI that reads/writes `docs/features/backlog.json`. The `/ticket` skill calls the script via Bash for data operations and handles AI-assisted workflows (`next`, `add`). Node 22 runs TypeScript directly via `--experimental-strip-types`.

**Tech Stack:** TypeScript, Node 22, Claude Code skills (markdown), JSON.

---

### Task 1: Create backlog.json with migrated tickets

**Files:**
- Create: `docs/features/backlog.json`

**Step 1: Create the JSON file**

Migrate existing feature docs into an ordered array following the current README.md priority order. Each entry has `id`, `title`, `status`, and `doc` path. All are `status: "backlog"` except `011` which is `"in-progress"`.

Tickets in priority order:
1. 007 Screen Wake Lock
2. 006 Workout Progress Indicator
3. 001 Rest Timer
4. 005 Dark Mode
5. 004 Plate Calculator
6. 008 PR Detection
7. 003 Progression Charts
8. 002 PWA + Offline
9. 009 Deload Detection
10. 010 Workout Notes
11. 011 Admin Plan Editor UX (in-progress)

**Step 2: Verify all `doc` paths point to existing files**

**Step 3: Commit**

```bash
git add docs/features/backlog.json
git commit -m "Add backlog.json with migrated feature tickets"
```

---

### Task 2: Create scripts/ticket.ts CLI

**Files:**
- Create: `scripts/ticket.ts`

**Run with:** `node --experimental-strip-types scripts/ticket.ts <command> [args]`

**Step 1: Implement the CLI with these commands**

The script reads/writes `docs/features/backlog.json` (path relative to project root). All output goes to stdout as formatted text.

**Commands:**

`list` — Print a formatted table, grouped by status (in-progress first, planned, backlog, done). Show position number, ID, status, and title.

```
 #  ID    Status        Title
 1  011   in-progress   Admin Plan Editor UX
 2  007   backlog       Screen Wake Lock
 3  006   backlog       Workout Progress Indicator
 ...
```

`add <title> [--doc <path>] [--description <text>]` — Auto-generate next ID (max numeric ID + 1, zero-padded to 3 digits). Append to end of array. At least one of `--doc` or `--description` required. Print confirmation with the new ticket's position and ID.

`show <pos|id>` — Print ticket fields. If ticket has a `doc`, print the path (the skill will read the file separately). If `description`, print it.

`move <pos|id> to <target-pos>` — Remove ticket from current position, insert at target (1-based). Print updated list.

`status <pos|id> <new-status>` — Validate status is one of: `backlog`, `planned`, `in-progress`, `done`. Update and save. Print confirmation.

`delete <pos|id>` — Remove entry from array. Do NOT delete linked files. Print confirmation.

`next` — Find first ticket with `status: "backlog"`, print its details (ID, title, doc path or description). Exit with code 0 if found, 1 if no backlog tickets.

`readme` — Generate `docs/features/README.md` from the JSON. Group by status, create markdown tables with links to doc files. Overwrite the file. Print confirmation.

**Argument resolution:** Parse the `<pos|id>` argument. Try matching as ID first (exact string match). If no match, try as 1-based position number. Error if neither matches.

**Error handling:** Print clear error messages to stderr and exit with code 1 for invalid commands, missing arguments, invalid references.

**Step 2: Test the script manually**

```bash
node --experimental-strip-types scripts/ticket.ts list
node --experimental-strip-types scripts/ticket.ts show 007
node --experimental-strip-types scripts/ticket.ts show 1
```

**Step 3: Commit**

```bash
git add scripts/ticket.ts
git commit -m "Add ticket CLI script for backlog management"
```

---

### Task 3: Create the /ticket skill

**Files:**
- Create: `.claude/skills/ticket/SKILL.md`

**Step 1: Write the skill file**

YAML frontmatter: `name: ticket`, `user-invocable: true`, description explaining it manages the feature backlog.

The skill body instructs Claude to:

1. Parse the user's argument to determine the subcommand.
2. For most commands (`list`, `show`, `move`, `status`, `delete`, `readme`): run the script via Bash and display the output.
3. For `add`: ask the user whether they want a full `.md` doc or an inline description, then call the script with appropriate flags.
4. For `next`: run the script's `next` command to get the top backlog ticket. If it has a `doc`, read that file. Then invoke the brainstorming skill to start planning the feature.
5. For `edit <pos|id>`: run `show` to get the ticket, then if it has a `doc` path, open that file for editing. If inline `description`, ask for new text and update via the script.
6. If no argument given, run `list`.

The script command format:
```bash
node --experimental-strip-types scripts/ticket.ts <command> [args]
```

**Step 2: Commit**

```bash
git add .claude/skills/ticket/SKILL.md
git commit -m "Add /ticket skill for backlog management"
```

---

### Task 4: Generate initial README.md and final verification

**Step 1: Run readme generation**

```bash
node --experimental-strip-types scripts/ticket.ts readme
```

**Step 2: Verify the generated README.md looks correct**

Should have all 11 tickets grouped by status with links.

**Step 3: Smoke test the full workflow**

- `list` shows all tickets
- `add "Test Ticket" --description "Testing"` adds at end
- `move` reorders correctly
- `status` updates correctly
- `delete` removes the test ticket
- `show` works by both position and ID

**Step 4: Commit**

```bash
git add docs/features/README.md
git commit -m "Regenerate README.md from backlog.json"
```
