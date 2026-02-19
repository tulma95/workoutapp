---
name: ticket
description: "Manage the feature backlog. List, add, prioritize, and pick the next ticket to work on. Triggers on: ticket, backlog, feature list, next feature, prioritize."
user-invocable: true
---

# Ticket — Backlog Management

Manage the project's feature backlog stored in `docs/backlog/backlog.json`.

---

## The Script

All data operations go through the CLI script:

```bash
node --experimental-strip-types docs/backlog/ticket.ts <command> [args]
```

---

## Commands

Parse the user's argument after `/ticket` to determine the subcommand. If no argument is given, run `list`.

**IMPORTANT:** After ANY mutation command (add, move, status, delete), the script prints the updated backlog table. You MUST always display this full table output to the user so they can see the current state.

### list

Run the script and display the output to the user:

```bash
node --experimental-strip-types docs/backlog/ticket.ts list
```

Output is a formatted table grouped by status (in-progress first, then planned, backlog, done). Show it to the user exactly as returned:

```
 #  ID    Status        Title
11  011   in-progress   Admin Plan Editor UX
 1  007   backlog       Screen Wake Lock
 2  006   backlog       Workout Progress Indicator
 3  001   backlog       Rest Timer
...
```

`#` is the ticket's position (for use with move/show/etc). `ID` is the stable identifier.

### show <pos|id>

Run the script and display the output:

```bash
node --experimental-strip-types docs/backlog/ticket.ts show <ref>
```

If the ticket has a `Doc:` path in the output, also read that file and display its contents.

### add

Ask the user for:
1. **Title** (required)
2. **Full doc or inline description?**
   - If doc: ask for the path or create a new stub file at `docs/backlog/features/<id>-<slug>.md`
   - If inline: ask for the description text

Then run:

```bash
node --experimental-strip-types docs/backlog/ticket.ts add "<title>" --doc <path>
# or
node --experimental-strip-types docs/backlog/ticket.ts add "<title>" --description "<text>"
```

### move <pos|id> to <target-pos>

Run:

```bash
node --experimental-strip-types docs/backlog/ticket.ts move <ref> to <target>
```

### status <pos|id> <new-status>

Valid statuses: `backlog`, `planned`, `in-progress`, `done`

```bash
node --experimental-strip-types docs/backlog/ticket.ts status <ref> <status>
```

### edit <pos|id>

First run `show` to get the ticket details. Then:
- If the ticket has a `doc` path, read and edit that markdown file based on user instructions.
- If the ticket has an inline `description`, ask for the new text and update via the `add` command or direct JSON edit.

### delete <pos|id>

Run:

```bash
node --experimental-strip-types docs/backlog/ticket.ts delete <ref>
```

### start <pos|id>

Set a ticket as the active working ticket and mark it as in-progress. Writes the ticket ID to `.current-ticket` (gitignored). This ID is used in commit messages.

```bash
node --experimental-strip-types docs/backlog/ticket.ts start <ref>
```

### current

Print the current active ticket ID. Use this before committing to get the ticket ID for the commit message prefix.

```bash
node --experimental-strip-types docs/backlog/ticket.ts current
```

### next

Pick the highest-priority backlog ticket and start planning it:

1. Run `node --experimental-strip-types docs/backlog/ticket.ts next` to get the top ticket
2. Start it: `node --experimental-strip-types docs/backlog/ticket.ts start <id>`
3. If it has a `doc` path, read the full feature document
4. Invoke the `superpowers:brainstorming` skill to start designing the implementation for this feature

### readme

Regenerate the README from the backlog:

```bash
node --experimental-strip-types docs/backlog/ticket.ts readme
```
