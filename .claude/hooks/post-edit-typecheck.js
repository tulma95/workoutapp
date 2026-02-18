#!/usr/bin/env node
/**
 * PostToolUse Hook: TypeScript check after editing .ts/.tsx files
 *
 * Runs after Edit/Write tool use on TypeScript files. Walks up from the file's
 * directory to find the nearest tsconfig.json, then runs tsc --noEmit
 * and reports only errors related to the edited file.
 *
 * Adapted from: https://github.com/affaan-m/everything-claude-code
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MAX_STDIN = 1024 * 1024;
let data = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  if (data.length < MAX_STDIN) {
    data += chunk;
  }
});

process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path;

    if (filePath && /\.(ts|tsx)$/.test(filePath)) {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        process.exit(0);
      }

      // Find nearest tsconfig.json by walking up (max 20 levels)
      let dir = path.dirname(resolvedPath);
      const root = path.parse(dir).root;
      let depth = 0;

      while (dir !== root && depth < 20) {
        if (fs.existsSync(path.join(dir, "tsconfig.json"))) {
          break;
        }
        dir = path.dirname(dir);
        depth++;
      }

      if (fs.existsSync(path.join(dir, "tsconfig.json"))) {
        try {
          execFileSync("npx", ["tsc", "--build", "--noEmit", "--pretty", "false"], {
            cwd: dir,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 30000,
          });
        } catch (err) {
          const output = (err.stdout || "") + (err.stderr || "");
          const relPath = path.relative(dir, resolvedPath);
          const candidates = new Set([filePath, resolvedPath, relPath]);
          const relevantLines = output
            .split("\n")
            .filter((line) => {
              for (const candidate of candidates) {
                if (line.includes(candidate)) return true;
              }
              return false;
            })
            .slice(0, 10);

          if (relevantLines.length > 0) {
            console.error(
              "[Hook] TypeScript errors in " + path.basename(filePath) + ":"
            );
            relevantLines.forEach((line) => console.error(line));
          }
        }
      }
    }
  } catch {
    // Invalid input — pass through
  }

  process.exit(0);
});
