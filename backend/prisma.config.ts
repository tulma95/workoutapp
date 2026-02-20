import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"] ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsc --project tsconfig.seed.json && node dist-seed/prisma/seed.js",
  },
  datasource: {
    url: databaseUrl,
  },
});
