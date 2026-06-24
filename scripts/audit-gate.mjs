#!/usr/bin/env node
// Production-dependency vulnerability gate for the deploy pipeline.
//
// Fails on ANY advisory in the runtime (`--omit=dev`) dependency tree that we
// have not explicitly reviewed and accepted by ID below. This is stricter than
// `npm audit --audit-level=high`: a NEW moderate landing in a real
// request-path dependency still fails, instead of being silently tolerated.
import { execFileSync } from 'node:child_process';

// Advisories we've reviewed and consciously accepted. Each MUST keep its reason.
const ALLOWLIST = new Map([
  [
    'GHSA-92pp-h63x-v22m',
    '@hono/node-server serveStatic middleware bypass — pulled in only by the ' +
      'Prisma CLI dev server (@prisma/dev), which never runs in production ' +
      "(`prisma migrate deploy` doesn't start hono). Only fixable by downgrading " +
      'Prisma off v7.',
  ],
]);

function getAuditJson() {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' }),
    );
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities exist; the JSON report is
    // still written to stdout, so parse that rather than treating it as failure.
    if (err.stdout) return JSON.parse(err.stdout);
    throw err;
  }
}

const audit = getAuditJson();
const found = new Map(); // advisoryId -> { severity, title, module }
for (const [name, vuln] of Object.entries(audit.vulnerabilities || {})) {
  for (const via of vuln.via || []) {
    if (typeof via !== 'object' || !via.url) continue;
    const id = via.url.split('/').pop();
    found.set(id, { severity: via.severity, title: via.title, module: name });
  }
}

const unexpected = [...found.entries()].filter(([id]) => !ALLOWLIST.has(id));

if (unexpected.length === 0) {
  const tolerated = [...found.keys()].filter((id) => ALLOWLIST.has(id));
  console.log(
    `Audit gate passed. Tolerated allowlisted advisories: ${
      tolerated.join(', ') || 'none'
    }.`,
  );
  process.exit(0);
}

console.error('Audit gate FAILED — unaccepted advisories in production dependencies:');
for (const [id, info] of unexpected) {
  console.error(`  [${info.severity}] ${id} (${info.module}): ${info.title}`);
}
console.error(
  '\nRun `npm audit fix`. If an advisory is genuinely not exploitable here, add ' +
    'its ID with a justification to ALLOWLIST in scripts/audit-gate.mjs.',
);
process.exit(1);
