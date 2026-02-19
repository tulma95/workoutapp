import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Paths ───

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROMPTS_DIR = join(__dirname, "prompts");
const STATE_DIR = join(ROOT, ".auto-dev");
const STATE_FILE = join(STATE_DIR, "state.json");
const PLAN_FILE = join(STATE_DIR, "plan.md");
const TASKS_FILE = join(STATE_DIR, "tasks.txt");
const LOG_FILE = join(STATE_DIR, "log.txt");

// ─── Args ───

const args = process.argv.slice(2);
let model = "sonnet";
let reset = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--model" && args[i + 1]) {
    model = args[i + 1];
    i++;
  } else if (args[i] === "--reset") {
    reset = true;
  }
}

// ─── State helpers ───

function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + "\n");
}

function readState() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

function updateState(updates) {
  const state = readState();
  Object.assign(state, updates);
  writeState(state);
  return state;
}

function markTaskDone(taskNum) {
  const state = readState();
  const done = new Set(state.tasks_completed || []);
  done.add(taskNum);
  state.tasks_completed = [...done].sort((a, b) => a - b);
  state.current_task = taskNum + 1;
  writeState(state);
}

// ─── Prompt helpers ───

function loadPrompt(name, vars = {}) {
  let text = readFileSync(join(PROMPTS_DIR, `${name}.txt`), "utf-8");
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`{{${key}}}`, String(value));
  }
  return text;
}

// Sandbox settings file — OS-level filesystem + network isolation,
// plus permission allow/deny rules for tool access.
const SANDBOX_SETTINGS = join(__dirname, "sandbox-settings.json");

function runClaude(prompt, extraFlags = "") {
  const args = [
    "-p",
    "--permission-mode", "default",
    "--model", model,
    "--verbose",
    "--settings", SANDBOX_SETTINGS,
    ...extraFlags.split(/\s+/).filter(Boolean),
  ];

  log(`Running: claude ${args.join(" ")}`);
  log(`Prompt length: ${prompt.length} chars`);

  const result = spawnSync("claude", args, {
    cwd: ROOT,
    input: prompt,
    stdio: ["pipe", "inherit", "inherit"],
    timeout: 15 * 60 * 1000, // 15 min per phase
    env: { ...process.env },
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) {
    log(`Claude spawn error: ${result.error.message}`);
    throw result.error;
  }

  if (result.status && result.status !== 0) {
    log(`Claude exited with code ${result.status}`);
    throw new Error(`Claude failed (exit ${result.status})`);
  }
}

// ─── Phases ───

function phasePlan() {
  log("Phase 1: Picking next ticket and planning...");
  updateState({ phase: "planning", started_at: new Date().toISOString() });

  const prompt = loadPrompt("plan", {
    PLAN_FILE,
    TASKS_FILE,
    STATE_FILE,
    TIMESTAMP: new Date().toISOString(),
  });

  runClaude(prompt);

  if (!existsSync(TASKS_FILE)) {
    log("ERROR: Planning did not produce tasks file. Aborting.");
    process.exit(1);
  }

  const tasks = readTasks();
  log(`Plan created with ${tasks.length} tasks. See ${PLAN_FILE}`);
  console.log("\n--- Plan ---");
  if (existsSync(PLAN_FILE)) {
    console.log(readFileSync(PLAN_FILE, "utf-8"));
  }
  console.log("--- End Plan ---\n");
}

function readTasks() {
  if (!existsSync(TASKS_FILE)) return [];
  return readFileSync(TASKS_FILE, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function phaseExecute() {
  const state = readState();
  const tasks = readTasks();
  const totalTasks = tasks.length;
  let currentTask = state.current_task || 1;
  const ticketId = state.ticket_id || "???";

  if (totalTasks === 0) {
    log("ERROR: No tasks found. Aborting.");
    process.exit(1);
  }

  // Update total in case it wasn't set
  updateState({ total_tasks: totalTasks });

  log(`Phase 2: Executing tasks (${currentTask} to ${totalTasks})...`);

  for (let i = 0; i < tasks.length; i++) {
    const taskNum = i + 1;
    if (taskNum < currentTask) {
      log(`Skipping task ${taskNum} (already done)`);
      continue;
    }

    log(`Task ${taskNum}/${totalTasks}: ${tasks[i]}`);

    const prompt = loadPrompt("execute", {
      TICKET_ID: ticketId,
      TASK_NUM: taskNum,
      TOTAL_TASKS: totalTasks,
      PLAN_FILE,
      TASK_DESCRIPTION: tasks[i],
    });

    runClaude(prompt);
    markTaskDone(taskNum);
    log(`Task ${taskNum} completed.`);
  }

  updateState({ phase: "finalizing" });
  log("All tasks executed. Moving to finalization.");
}

function phaseFinalize() {
  const state = readState();
  const ticketId = state.ticket_id || "???";

  log(`Phase 3: Testing, reviewing, and committing ticket ${ticketId}...`);

  const prompt = loadPrompt("finalize", {
    TICKET_ID: ticketId,
    PLAN_FILE,
  });

  runClaude(prompt, "--max-budget-usd 5");

  updateState({ phase: "done", completed_at: new Date().toISOString() });
  log(`Ticket ${ticketId} finalized and committed.`);
}

// ─── Main ───

ensureStateDir();

if (reset) {
  log("Resetting state...");
  for (const f of [STATE_FILE, PLAN_FILE, TASKS_FILE]) {
    if (existsSync(f)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(f);
    }
  }
  log("State cleared. Run again to start fresh.");
  process.exit(0);
}

const state = readState();
const phase = state.phase || "";

console.log("");
console.log("============================================");
console.log("  AUTO-DEV: Workout Tracker");
console.log(`  Model: ${model}`);
if (phase && phase !== "done") {
  console.log(`  Resuming: ticket ${state.ticket_id}, phase: ${phase}`);
} else {
  console.log("  Starting new ticket");
}
console.log("============================================");
console.log("");

try {
  // Phase 1: Plan (only if no active work)
  if (!phase || phase === "done") {
    phasePlan();
  }

  // Phase 2: Execute tasks
  const currentPhase = readState().phase;
  if (currentPhase === "executing") {
    phaseExecute();
  }

  // Phase 3: Finalize
  const finalPhase = readState().phase;
  if (finalPhase === "finalizing") {
    phaseFinalize();
  }
} catch (err) {
  log(`ERROR: ${err.message}`);
  log("State preserved. Run ./auto_dev.sh again to resume.");
  process.exit(1);
}

// Done!
const finalState = readState();
console.log("");
console.log("============================================");
console.log(`  AUTO-DEV: Ticket ${finalState.ticket_id} done!`);
console.log(`  ${finalState.ticket_title}`);
console.log("");
console.log(`  State: ${STATE_FILE}`);
console.log(`  Log:   ${LOG_FILE}`);
console.log(`  Plan:  ${PLAN_FILE}`);
console.log("");
console.log("  Run ./auto_dev.sh again for the next ticket.");
console.log("============================================");
