import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Inyectamos el comando nativo para ejecutar tu script de Node.js en Prisma 7
    seed: "node ./prisma/seed.js", 
  },
  datasource: {
    url: "postgresql://unimarket:unimarket@localhost:5432/unimarketdb",
  },
});