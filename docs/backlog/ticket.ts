#!/usr/bin/env node

/**
 * ticket.ts — Backlog management CLI
 *
 * Usage: node --experimental-strip-types docs/backlog/ticket.ts <command> [args]
 *
 * Commands: list, add, show, move, status, delete, next, readme, start, current, clear
 */

const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");
const { parseArgs } = require("node:util") as typeof import("node:util");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TicketStatus = "backlog" | "planned" | "in-progress" | "done";
type TicketPriority = "low" | "medium" | "high";

interface Ticket {
  id: string;
  title: string;
  status: TicketStatus;
  priority?: TicketPriority;
  doc?: string;
  description?: string;
}

const VALID_PRIORITIES: TicketPriority[] = ["low", "medium", "high"];

const VALID_STATUSES: TicketStatus[] = [
  "backlog",
  "planned",
  "in-progress",
  "done",
];

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const BACKLOG_DIR = __dirname;
const PROJECT_ROOT = path.resolve(BACKLOG_DIR, "..", "..");
const BACKLOG_PATH = path.join(BACKLOG_DIR, "backlog.json");
const README_PATH = path.join(BACKLOG_DIR, "README.md");
const CURRENT_TICKET_PATH = path.join(PROJECT_ROOT, ".current-ticket");

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function readBacklog(): Ticket[] {
  const raw = fs.readFileSync(BACKLOG_PATH, "utf-8");
  return JSON.parse(raw) as Ticket[];
}

function writeBacklog(tickets: Ticket[]): void {
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(tickets, null, 2) + "\n");
}

function die(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Argument resolution: <pos|id> -> index in array (0-based)
// ---------------------------------------------------------------------------

function resolveRef(tickets: Ticket[], ref: string): number {
  // Try exact ID match first
  const byId = tickets.findIndex((t) => t.id === ref);
  if (byId !== -1) return byId;

  // Try 1-based position
  const pos = parseInt(ref, 10);
  if (!Number.isNaN(pos) && pos >= 1 && pos <= tickets.length) {
    return pos - 1;
  }

  die(`No ticket found for "${ref}" (tried as ID and position)`);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function printTable(tickets: Ticket[], positions: number[]): void {
  const header = `${"#".padStart(2)}  ${"ID".padEnd(5)} ${"Status".padEnd(13)} Title`;
  console.log(header);

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const pos = positions[i];
    const line = `${String(pos).padStart(2)}  ${ticket.id.padEnd(5)} ${ticket.status.padEnd(13)} ${ticket.title}`;
    console.log(line);
  }
}

// ---------------------------------------------------------------------------
// Status display order and labels
// ---------------------------------------------------------------------------

const STATUS_ORDER: TicketStatus[] = [
  "in-progress",
  "planned",
  "backlog",
  "done",
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  "in-progress": "In Progress",
  planned: "Planned",
  backlog: "Backlog",
  done: "Done",
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdList(): void {
  const tickets = readBacklog();

  const grouped: Ticket[] = [];
  const groupedPositions: number[] = [];

  for (const status of STATUS_ORDER) {
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i].status === status) {
        grouped.push(tickets[i]);
        groupedPositions.push(i + 1); // 1-based position in original array
      }
    }
  }

  printTable(grouped, groupedPositions);
}

function cmdAdd(commandArgs: string[]): void {
  // parseArgs separates --doc / --description flags from positional title words
  const { values, positionals } = parseArgs({
    args: commandArgs,
    options: {
      doc: { type: "string" },
      description: { type: "string" },
      priority: { type: "string" },
    },
    allowPositionals: true,
  });

  const title = positionals.join(" ").trim();
  if (!title) {
    die("Usage: add <title> [--doc <path>] [--description <text>] [--priority <low|medium|high>]");
  }

  if (!values.doc && !values.description) {
    die("At least one of --doc or --description is required");
  }

  if (values.priority && !VALID_PRIORITIES.includes(values.priority as TicketPriority)) {
    die(`Invalid priority "${values.priority}". Must be one of: ${VALID_PRIORITIES.join(", ")}`);
  }

  const tickets = readBacklog();

  // Auto-generate next ID (max numeric ID + 1, zero-padded to 3 digits)
  const maxId = tickets.reduce((max, t) => {
    const num = parseInt(t.id, 10);
    return Number.isNaN(num) ? max : Math.max(max, num);
  }, 0);
  const newId = String(maxId + 1).padStart(3, "0");

  const newTicket: Ticket = {
    id: newId,
    title,
    status: "backlog",
    ...(values.priority !== undefined && { priority: values.priority as TicketPriority }),
    ...(values.doc !== undefined && { doc: values.doc }),
    ...(values.description !== undefined && { description: values.description }),
  };

  tickets.push(newTicket);
  writeBacklog(tickets);

  console.log(`Added ticket #${tickets.length} [${newId}]: ${title}`);
  console.log("");
  cmdList();
}

function cmdShow(ref: string): void {
  const tickets = readBacklog();
  const idx = resolveRef(tickets, ref);
  const ticket = tickets[idx];

  console.log(`Position:    ${idx + 1}`);
  console.log(`ID:          ${ticket.id}`);
  console.log(`Title:       ${ticket.title}`);
  console.log(`Status:      ${ticket.status}`);
  if (ticket.priority) {
    console.log(`Priority:    ${ticket.priority}`);
  }

  if (ticket.doc) {
    console.log(`Doc:         ${ticket.doc}`);
  }
  if (ticket.description) {
    console.log(`Description: ${ticket.description}`);
  }
}

function cmdMove(fromRef: string, targetPosStr: string): void {
  const tickets = readBacklog();
  const fromIdx = resolveRef(tickets, fromRef);
  const targetPos = parseInt(targetPosStr, 10);

  if (Number.isNaN(targetPos) || targetPos < 1 || targetPos > tickets.length) {
    die(
      `Target position must be a number between 1 and ${tickets.length}, got: "${targetPosStr}"`
    );
  }

  const [ticket] = tickets.splice(fromIdx, 1);
  tickets.splice(targetPos - 1, 0, ticket);
  writeBacklog(tickets);

  console.log(`Moved [${ticket.id}] "${ticket.title}" to position ${targetPos}`);
  console.log("");
  cmdList();
}

function cmdStatus(ref: string, newStatus: string): void {
  if (!VALID_STATUSES.includes(newStatus as TicketStatus)) {
    die(
      `Invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }

  const tickets = readBacklog();
  const idx = resolveRef(tickets, ref);
  const ticket = tickets[idx];
  const oldStatus = ticket.status;

  ticket.status = newStatus as TicketStatus;
  writeBacklog(tickets);

  // Auto-clear current ticket when marking it as done
  if (newStatus === "done" && fs.existsSync(CURRENT_TICKET_PATH)) {
    const raw = fs.readFileSync(CURRENT_TICKET_PATH, "utf-8").trim();
    const currentId = JSON.parse(raw).id;
    if (currentId === ticket.id) {
      fs.unlinkSync(CURRENT_TICKET_PATH);
      console.log(`Cleared current ticket.`);
    }
  }

  console.log(`[${ticket.id}] "${ticket.title}": ${oldStatus} -> ${newStatus}`);
  console.log("");
  cmdList();
}

function cmdDelete(ref: string): void {
  const tickets = readBacklog();
  const idx = resolveRef(tickets, ref);
  const [ticket] = tickets.splice(idx, 1);
  writeBacklog(tickets);

  console.log(`Deleted [${ticket.id}]: ${ticket.title}`);
  console.log("");
  cmdList();
}

function cmdNext(): void {
  const tickets = readBacklog();
  const ticket = tickets.find((t) => t.status === "backlog");

  if (!ticket) {
    process.stderr.write("No backlog tickets found\n");
    process.exit(1);
  }

  const pos = tickets.indexOf(ticket) + 1;
  console.log(`Next backlog ticket:`);
  console.log(`  Position:    ${pos}`);
  console.log(`  ID:          ${ticket.id}`);
  console.log(`  Title:       ${ticket.title}`);
  if (ticket.priority) {
    console.log(`  Priority:    ${ticket.priority}`);
  }

  if (ticket.doc) {
    console.log(`  Doc:         ${ticket.doc}`);
  }
  if (ticket.description) {
    console.log(`  Description: ${ticket.description}`);
  }
}

function cmdStart(ref: string): void {
  const tickets = readBacklog();
  const idx = resolveRef(tickets, ref);
  const ticket = tickets[idx];

  fs.writeFileSync(CURRENT_TICKET_PATH, JSON.stringify({ id: ticket.id, title: ticket.title }) + "\n");

  if (ticket.status === "backlog" || ticket.status === "planned") {
    const oldStatus = ticket.status;
    ticket.status = "in-progress";
    writeBacklog(tickets);
    console.log(`[${ticket.id}] "${ticket.title}": ${oldStatus} -> in-progress`);
  } else {
    console.log(`[${ticket.id}] "${ticket.title}" (status: ${ticket.status})`);
  }

  console.log(`Current ticket set to: ${ticket.id}`);
}

function cmdCurrent(): void {
  if (!fs.existsSync(CURRENT_TICKET_PATH)) {
    die("No current ticket set. Use: ticket start <pos|id>");
  }

  const raw = fs.readFileSync(CURRENT_TICKET_PATH, "utf-8").trim();
  const data = JSON.parse(raw);
  const tickets = readBacklog();
  const ticket = tickets.find((t) => t.id === data.id);

  if (!ticket) {
    die(`Current ticket ID "${data.id}" not found in backlog`);
  }

  console.log(`${data.id}: ${data.title}`);
}

function cmdClear(): void {
  if (!fs.existsSync(CURRENT_TICKET_PATH)) {
    console.log("No current ticket set.");
    return;
  }

  const raw = fs.readFileSync(CURRENT_TICKET_PATH, "utf-8").trim();
  const data = JSON.parse(raw);
  fs.unlinkSync(CURRENT_TICKET_PATH);
  console.log(`Cleared current ticket (was: ${data.id}: ${data.title})`);
}

function cmdReadme(): void {
  const tickets = readBacklog();

  const lines: string[] = [
    "# Backlog",
    "",
    "Managed by `docs/backlog/ticket.ts`. Edit `docs/backlog/backlog.json` directly or use the CLI.",
    "",
  ];

  for (const status of STATUS_ORDER) {
    const group = tickets.filter((t) => t.status === status);
    if (group.length === 0) continue;

    lines.push(`## ${STATUS_LABELS[status]}`);
    lines.push("");
    lines.push("| # | ID | Title | Doc |");
    lines.push("|---|-----|-------|-----|");

    for (const ticket of group) {
      const pos = tickets.indexOf(ticket) + 1;

      let docCell = "";
      if (ticket.doc) {
        // Build relative path from docs/backlog/ to the doc file
        const docAbsolute = path.join(PROJECT_ROOT, ticket.doc);
        const rel = path.relative(BACKLOG_DIR, docAbsolute);
        docCell = `[doc](${rel})`;
      }

      lines.push(`| ${pos} | ${ticket.id} | ${ticket.title} | ${docCell} |`);
    }

    lines.push("");
  }

  fs.writeFileSync(README_PATH, lines.join("\n"));
  console.log(`Written: ${README_PATH}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const [command, ...commandArgs] = process.argv.slice(2);

if (!command) {
  die("Usage: ticket.ts <list|add|show|move|status|delete|next|readme|start|current|clear> [args]");
}

switch (command) {
  case "list":
    cmdList();
    break;

  case "add":
    cmdAdd(commandArgs);
    break;

  case "show":
    if (commandArgs.length === 0) die("Usage: show <pos|id>");
    cmdShow(commandArgs[0]);
    break;

  case "move":
    if (commandArgs.length < 3 || commandArgs[1] !== "to") {
      die("Usage: move <pos|id> to <target-pos>");
    }
    cmdMove(commandArgs[0], commandArgs[2]);
    break;

  case "status":
    if (commandArgs.length < 2) die("Usage: status <pos|id> <new-status>");
    cmdStatus(commandArgs[0], commandArgs[1]);
    break;

  case "delete":
    if (commandArgs.length === 0) die("Usage: delete <pos|id>");
    cmdDelete(commandArgs[0]);
    break;

  case "next":
    cmdNext();
    break;

  case "readme":
    cmdReadme();
    break;

  case "start":
    if (commandArgs.length === 0) die("Usage: start <pos|id>");
    cmdStart(commandArgs[0]);
    break;

  case "current":
    cmdCurrent();
    break;

  case "clear":
    cmdClear();
    break;

  default:
    die(
      `Unknown command: "${command}". Valid commands: list, add, show, move, status, delete, next, readme, start, current, clear`
    );
}
