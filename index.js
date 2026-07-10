import express from "express"
import bodyParser from "body-parser"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/index.js" // Ruta personalizada del cliente
import 'dotenv/config'

const app = express()
const PORT = 3000


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))


const cadenaConexion = process.env.DATABASE_URL?.includes("unimarketdb")
  ? process.env.DATABASE_URL
  : "postgresql://unimarket:unimarket@localhost:5432/unimarketdb"

const pool = new Pool({ connectionString: cadenaConexion })
// Inyectamos el pool al adaptador de Prisma para optimizar el rendimiento
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })


app.get("/", (req, res) => {
    res.json({
        mensaje: "¡Servidor de UniMarket corriendo e integrado con PostgreSQL con éxito!",
        status: "OK"
    })
})


app.listen(PORT, () => {
    console.log("Iniciando servidor en puerto " + PORT)
})