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

### list

Run the script and display the output:

```bash
node --experimental-strip-types docs/backlog/ticket.ts list
```

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
   - If doc: ask for the path or create a new stub file at `docs/features/<id>-<slug>.md`
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

### next

Pick the highest-priority backlog ticket and start planning it:

1. Run `node --experimental-strip-types docs/backlog/ticket.ts next` to get the top ticket
2. Mark it as `planned`: `node --experimental-strip-types docs/backlog/ticket.ts status <id> planned`
3. If it has a `doc` path, read the full feature document
4. Invoke the `superpowers:brainstorming` skill to start designing the implementation for this feature

### readme

Regenerate the README from the backlog:

```bash
node --experimental-strip-types docs/backlog/ticket.ts readme
```
