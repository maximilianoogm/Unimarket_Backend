import "dotenv/config";
import process from "process"; // <-- Añadimos esta importación nativa de Node.js
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node ./prisma/seed.js", 
  },
  datasource: {
    url: process.env.DATABASE_URL, 
  },
});