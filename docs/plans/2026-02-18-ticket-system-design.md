# Ticket System Design

**Date:** 2026-02-18
**Status:** Approved

## Overview

A CLI-based ticket management system for the workout tracker's feature backlog. Uses a JSON index file for priority ordering with existing markdown files for detailed specs. Managed entirely through a Claude Code `/ticket` skill.

## Data Model

**File:** `docs/features/backlog.json`

An ordered JSON array where position = priority (index 0 = highest). Each entry:

```json
[
  {
    "id": "007",
    "title": "Screen Wake Lock",
    "status": "backlog",
    "doc": "docs/features/007-screen-wake-lock.md"
  },
  {
    "id": "012",
    "title": "Export workouts as CSV",
    "status": "backlog",
    "description": "GET /api/workouts/export endpoint. Simple link on history page."
  }
]
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Stable identifier, auto-incremented from highest existing |
| `title` | string | yes | Short ticket name |
| `status` | string | yes | One of: `backlog`, `planned`, `in-progress`, `done` |
| `doc` | string | no | Path to detailed `.md` file |
| `description` | string | no | Inline description for quick tickets |

At least one of `doc` or `description` must be present.

### Addressing

Tickets can be referenced by:
- **Position** — current index in the list (1-based in display)
- **ID** — stable string that doesn't change on reorder

## The `/ticket` Skill

Located at `.claude/skills/ticket.md`. Claude reads/writes `docs/features/backlog.json` directly.

### Commands

| Command | Description |
|---------|-------------|
| `list` | Pretty-print all tickets by priority, grouped by status |
| `add "Title"` | Create new ticket. Prompt for doc vs inline description. Appends to end of backlog. |
| `show <pos\|id>` | Display ticket details. Reads linked `.md` if present. |
| `move <pos\|id> to <pos>` | Reorder by splicing the array |
| `status <pos\|id> <new-status>` | Update status field |
| `edit <pos\|id>` | Edit the linked `.md` or inline description |
| `delete <pos\|id>` | Remove from JSON (does not delete `.md` files) |
| `next` | Pick first backlog ticket, mark as `planned`, invoke brainstorming/planning workflow |
| `readme` | Regenerate `docs/features/README.md` from JSON |

### Display Format

```
 #  ID    Status       Title
 1  007   backlog      Screen Wake Lock
 2  006   backlog      Workout Progress Indicator
 3  001   backlog      Rest Timer
```

### `next` Workflow

1. Find first entry with `status: "backlog"`
2. Mark it as `planned`
3. Read its full doc/description
4. Invoke the brainstorming skill to start designing the implementation

## Migration

Existing 10 feature docs get entries in `backlog.json`, ordered per current README.md priority:

1. `007` Screen Wake Lock
2. `006` Workout Progress Indicator
3. `001` Rest Timer
4. `005` Dark Mode
5. `004` Plate Calculator
6. `008` PR Detection
7. `003` Progression Charts
8. `002` PWA + Offline
9. `009` Deload Detection
10. `010` Workout Notes
11. `011` Admin Plan Editor UX (status: `in-progress`)

## File Structure

```
docs/features/
  backlog.json          # source of truth for ordering
  README.md             # auto-generated from backlog.json
  001-rest-timer.md     # unchanged
  ...
.claude/skills/
  ticket.md             # the /ticket skill
```

## README Generation

The `readme` command regenerates `docs/features/README.md` from `backlog.json`, producing a markdown table grouped by status with links to `.md` files. Keeps GitHub browsing in sync without manual editing.

## Design Decisions

- **No effort/tags fields** — YAGNI. Effort estimates live in the feature docs themselves. Tags unnecessary at <20 tickets.
- **Array position for priority** — No integer priority field needed. Reorder = array splice.
- **Stable IDs** — Tickets keep their ID across reorders so references don't break.
- **Don't delete .md files on ticket delete** — Preserves history.
- **Skill is the sole interface** — Mitigates the two-source-of-truth risk between JSON and .md files.
