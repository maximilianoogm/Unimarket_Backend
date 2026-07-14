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
        favoritos: true, 
        _count: { select: { productos: true } },
      },
    });

    if (!userProfile) return res.status(404).json({ error: "Usuario no encontrado." });

    res.json({
      id: userProfile.id,
      name: userProfile.nombre,
      email: userProfile.email,
      totalPublicaciones: userProfile._count.productos, 
      productosFavoritos: userProfile.favoritos,    
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
      include: { detalles: true, tags: true, autor: true, categoria: true }
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
      include: { detalles: true, tags: true, autor: true, categoria: true }
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
// INTEGRANTE 4: FAVORITOS Y MENSAJERÍA
// ==========================================

app.post("/products/:id/favorite", async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ error: "El userId es obligatorio." });
    }

    const producto = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { usuariosFavorito: true },
    });

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    const yaEsFavorito = producto.usuariosFavorito.some(
      (usuario) => usuario.id === parseInt(userId)
    );

    const productoActualizado = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        usuariosFavorito: yaEsFavorito
          ? { disconnect: { id: parseInt(userId) } }
          : { connect: { id: parseInt(userId) } },
      },
      include: { usuariosFavorito: true },
    });

    res.json({
      message: yaEsFavorito ? "Producto quitado de favoritos" : "Producto agregado a favoritos",
      favorito: !yaEsFavorito,
      producto: productoActualizado,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar favoritos." });
  }
});

app.post("/messages", async (req, res) => {
  const { contenido, remitenteId, destinatarioId, productoId } = req.body;

  try {
    if (!contenido || !remitenteId || !destinatarioId || !productoId) {
      return res.status(400).json({
        error: "contenido, remitenteId, destinatarioId y productoId son obligatorios.",
      });
    }

    const nuevoMensaje = await prisma.chatMessage.create({
      data: {
        contenido,
        fechaEnvio: new Date().toISOString(),
        remitenteId: parseInt(remitenteId),
        destinatarioId: parseInt(destinatarioId),
        productoId: parseInt(productoId),
      },
    });

    res.status(201).json({ message: "Mensaje enviado con éxito", mensaje: nuevoMensaje });
  } catch (error) {
    res.status(500).json({ error: "Error al enviar el mensaje." });
  }
});

app.get("/messages/:productId", async (req, res) => {
  const { productId } = req.params;
  const { usuario1, usuario2 } = req.query;

  try {
    if (!usuario1 || !usuario2) {
      return res.status(400).json({
        error: "Los query params usuario1 y usuario2 son obligatorios para identificar la conversación.",
      });
    }

    const mensajes = await prisma.chatMessage.findMany({
      where: {
        productoId: parseInt(productId),
        OR: [
          { remitenteId: parseInt(usuario1), destinatarioId: parseInt(usuario2) },
          { remitenteId: parseInt(usuario2), destinatarioId: parseInt(usuario1) },
        ],
      },
      orderBy: { id: "asc" },
    });

    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el historial de mensajes." });
  }
});

// ==========================================
// INICIO DEL SERVIDOR (Solo uno)
// ==========================================
app.listen(PORT, () => {
    console.log("🚀 Servidor corriendo e integrado en el puerto " + PORT);
});