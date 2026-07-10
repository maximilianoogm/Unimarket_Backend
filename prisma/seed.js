import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/index.js"
import 'dotenv/config'

// Configuración del driver nativo igual que en el index
const cadenaConexion = process.env.DATABASE_URL?.includes("unimarketdb")
  ? process.env.DATABASE_URL
  : "postgresql://unimarket:unimarket@localhost:5432/unimarketdb"

const pool = new Pool({ connectionString: cadenaConexion })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Iniciando el poblamiento de la base de datos (Seed)...")

  // 1. Inyectar Categorías (Upsert evita duplicados si se corre dos veces)
  const catLibros = await prisma.category.upsert({
    where: { name: "Libros" },
    update: {},
    create: { name: "Libros" }
  })
  const catApuntes = await prisma.category.upsert({
    where: { name: "Apuntes y Copias" },
    update: {},
    create: { name: "Apuntes y Copias" }
  })
  await prisma.category.upsert({
    where: { name: "Herramientas de Laboratorio" },
    update: {},
    create: { name: "Herramientas de Laboratorio" }
  })

  // 2. Inyectar Etiquetas (Tags)
  const tagNuevo = await prisma.tag.upsert({
    where: { name: "Nuevo" },
    update: {},
    create: { name: "Nuevo" }
  })
  const tagUrgente = await prisma.tag.upsert({
    where: { name: "Urgente" },
    update: {},
    create: { name: "Urgente" }
  })
  await prisma.tag.upsert({
    where: { name: "Precio Negociable" },
    update: {},
    create: { name: "Precio Negociable" }
  })

  // 3. Inyectar un Usuario Base de prueba
  const usuarioPrueba = await prisma.user.upsert({
    where: { email: "alumno@universidad.edu.pe" },
    update: {},
    create: {
      email: "alumno@universidad.edu.pe",
      password: "password123", // En producción irá encriptada
      nombre: "Valentino Integrador",
      carrera: "Ingeniería de Sistemas",
      fechaRegistro: new Date().toISOString().split('T')[0]
    }
  })

  // 4. Inyectar un Producto de prueba con su relación 1:1 y N:M
  // Buscamos si ya existe para no duplicarlo en el seed
  const productoExistente = await prisma.product.findFirst({
    where: { titulo: "Libro de Cálculo en Varias Variables" }
  })

  if (!productoExistente) {
    await prisma.product.create({
      data: {
        titulo: "Libro de Cálculo en Varias Variables",
        descripcion: "Perfecto estado, ideal para segundo ciclo de ingeniería. Incluye solucionario.",
        precio: 45.50,
        fechaPublicacion: new Date().toISOString().split('T')[0],
        autorId: usuarioPrueba.id,
        categoryId: catLibros.id,
        // Relación 1:1 estricta (Detalles Extendidos)
        detalles: {
          create: {
            estado: "Como nuevo",
            ciclo: 2,
            stock: 1
          }
        },
        // Relación Muchos a Muchos N:M (Conectamos los tags creados arriba)
        tags: {
          connect: [
            { id: tagNuevo.id },
            { id: tagUrgente.id }
          ]
        }
      }
    })
    console.log("📦 Producto de prueba y detalles inyectados con éxito.");
  }

  console.log("✅ Base de datos poblada exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando el seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })