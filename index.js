import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/index.js" // Ruta personalizada del cliente
import 'dotenv/config'

const app = express()
const PORT = 3000

app.use(cors())
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

// INTEGRANTE 2//
app.post("/users", async (req, res) => {
  const { email, password, name } = req.body;
  try {
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Todos los campos (email, password, name) son obligatorios." });
    }
    const newUser = await prisma.user.create({
      data: {
        email,
        password, 
        name,
      },
    });
    res.status(201).json({ message: "Usuario registrado con éxito", user: newUser });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "El correo electrónico ya está registrado." });
    }
    res.status(500).json({ error: "Error interno del servidor al registrar." });
  }
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Credenciales incorrectas." });
    }

    res.json({ message: "Login exitoso", user });
  } catch (error) {
    res.status(500).json({ error: "Error interno en el inicio de sesión." });
  }
});

app.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const userProfile = await prisma.user.findUnique({
      where: { id: parseInt(id) }, 
      include: {
        favorites: true, 
        _count: {
          select: {
            posts: true, 
          },
        },
      },
    });

    if (!userProfile) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    res.json({
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      totalPublicaciones: userProfile._count.posts, 
      productosFavoritos: userProfile.favorites,    
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el perfil del usuario." });
  }
});

app.listen(PORT, () => {
    console.log("Iniciando servidor en puerto " + PORT) //[cite: 1]
})