# Code Review: Ticket {TICKET_ID} — {TICKET_TITLE}

You are reviewing all code changes for ticket {TICKET_ID} in the treenisofta workout tracker.

## What Was Built

{PLAN_SUMMARY}

## Key Decisions and Gotchas From Implementation

{INSIGHTS_SUMMARY}

## Git Range

**Base:** {BASE_SHA}
**Head:** {HEAD_SHA}

Start by running:
```bash
git diff --stat {BASE_SHA}..{HEAD_SHA}
git diff {BASE_SHA}..{HEAD_SHA}
```

Read CLAUDE.md for project conventions before reviewing.

## Review Checklist

**Code Quality:**
- Clean separation of concerns?
- Proper error handling?
- Type safety?
- DRY principle followed?
- Edge cases handled?

**Architecture:**
- Sound design decisions?
- Scalability considerations?
- Performance implications?
- Security concerns (OWASP top 10)?

**Testing:**
- Backend integration tests use real DB (no vi.mock for DB/config/bcrypt)?
- No frontend unit tests (E2E only per CLAUDE.md)?
- Edge cases covered?
- Test isolation (truncate in beforeAll)?

**CLAUDE.md Conventions:**
- CSS Modules with rem units, 8-point grid?
- Touch targets min 44px (3rem)?
- `formatWeight()` for all weight display?
- Zod schemas validate API responses?
- `<ButtonLink>` for navigation, not `navigate()` onClick?
- Native `<dialog>` for modals?
- TEXT columns (not VARCHAR) in Prisma schema with `@db.Text`?
- Append-only training_maxes pattern respected?
- React Query cache invalidation correct?
- No .env files (env vars from shell scripts)?
- Commit messages include ticket ID?

**Requirements:**
- All plan tasks implemented?
- Implementation matches spec?
- No scope creep?
- Breaking changes documented?

**Docs:**
- New/changed endpoints in `docs/api-endpoints.md`?
- Schema migrations in `docs/db-schema.md`?
- New queries/invalidation in `docs/react-query-cache.md`?

## Output Format

### Strengths
[What's well done — be specific with file:line references.]

### Issues

#### Critical (Must Fix)
[Bugs, security issues, data loss risks, broken functionality]

#### Important (Should Fix)
[Architecture problems, missing features, poor error handling, test gaps]

#### Minor (Nice to Have)
[Code style, optimization opportunities]

**For each issue:**
- File:line reference
- What's wrong
- Why it matters
- How to fix (if not obvious)

### Backlog Items

For any bugs found or improvement ideas discovered during review, add them to the backlog:
```bash
node --experimental-strip-types docs/backlog/ticket.ts add "<title>" --priority <low|medium|high>
```

### Assessment

**Ready to ship?** [Yes / No / With fixes]
**Reasoning:** [1-2 sentences]
