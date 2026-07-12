import express from "express"
import bodyParser from "body-parser"
import cors from "cors"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/index.js" // Ruta personalizada del cliente
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// CORRECCIÓN: Quitamos la validación de "unimarketdb" para que agarre tu URL de Render
const cadenaConexion = process.env.DATABASE_URL;

const pool = new Pool({ connectionString: cadenaConexion })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

app.get("/", (req, res) => {
    res.json({
        mensaje: "¡Servidor de UniMarket corriendo e integrado con PostgreSQL con éxito!",
        status: "OK"
    })
})

// ==========================================
// INTEGRANTE 2: USUARIOS Y AUTENTICACIÓN
// ==========================================
app.post("/users", async (req, res) => {
  const { email, password, name } = req.body;
  try {
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Todos los campos (email, password, name) son obligatorios." });
    }
    const newUser = await prisma.user.create({
      data: { email, password, name },
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
    const user = await prisma.user.findUnique({ where: { email } });
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
        _count: { select: { posts: true } },
      },
    });

    if (!userProfile) return res.status(404).json({ error: "Usuario no encontrado." });

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


// ==========================================
// INTEGRANTE 3: CATÁLOGO Y PRODUCTOS (TÚ)
// ==========================================

// 1. Obtener todos los productos (Para la galería principal)
app.get('/products', async (req, res) => {
  try {
    const productos = await prisma.product.findMany({
      include: { detalles: true, tags: true }
    });
    res.status(200).json(productos);
  } catch (error) {
    console.error("Error obteniendo catálogo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 2. Obtener un producto específico por ID
app.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { detalles: true, tags: true }
    });

    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
    res.status(200).json(producto);
  } catch (error) {
    console.error("Error buscando producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 3. Crear un producto (Reto técnico: Nested Writes)
app.post('/products', async (req, res) => {
  try {
    const { titulo, descripcion, precio, autorId, categoryId, estado, ciclo, stock } = req.body;

    const nuevoProducto = await prisma.product.create({
      data: {
        titulo,
        descripcion,
        precio: parseFloat(precio),
        fechaPublicacion: new Date().toISOString().split('T')[0],
        autorId: parseInt(autorId),
        categoryId: parseInt(categoryId),
        // Relación 1:1
        detalles: {
          create: {
            estado,
            ciclo: parseInt(ciclo),
            stock: parseInt(stock)
          }
        }
      },
      include: { detalles: true } 
    });

    res.status(201).json(nuevoProducto);
  } catch (error) {
    console.error("Error al crear producto:", error);
    res.status(500).json({ error: "No se pudo registrar el producto" });
  }
});

// ==========================================
// INICIO DEL SERVIDOR (Solo uno)
// ==========================================
app.listen(PORT, () => {
    console.log("🚀 Servidor corriendo e integrado en el puerto " + PORT);
});