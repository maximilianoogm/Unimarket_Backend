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
  // Aceptamos "nombre" (schema) o "name" por compatibilidad con el front.
  const { email, password, nombre, name, carrera } = req.body;
  const nombreFinal = nombre || name;
  try {
    if (!email || !password || !nombreFinal) {
      return res.status(400).json({ error: "Todos los campos (email, password, nombre) son obligatorios." });
    }
    const newUser = await prisma.user.create({
      data: {
        email,
        password,
        nombre: nombreFinal,
        ...(carrera ? { carrera } : {}),
        fechaRegistro: new Date().toISOString().split("T")[0],
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

// 0. Listar categorías (para poblar el selector del formulario de publicar)
app.get('/categories', async (req, res) => {
  try {
    const categorias = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json(categorias);
  } catch (error) {
    console.error("Error obteniendo categorías:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

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

// 4. Editar un producto existente (PUT)
app.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, precio, categoryId, estado, ciclo, stock } = req.body;

    const productoActualizado = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        titulo,
        descripcion,
        precio: parseFloat(precio),
        categoryId: parseInt(categoryId),
        detalles: {
          update: {
            estado,
            ciclo: parseInt(ciclo),
            stock: parseInt(stock)
          }
        }
      },
      include: { detalles: true }
    });

    res.status(200).json(productoActualizado);
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ error: "No se pudo actualizar el producto" });
  }
});

// 5. Eliminar un producto (DELETE - Nombres del Schema Corregidos)
app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    console.log("🗑️ Intentando eliminar producto ID en backend:", productId);

    // 1. Eliminamos los detalles usando el nombre exacto del modelo con 's' (productDetails)
    await prisma.productDetails.deleteMany({
      where: { productId: productId }
    });
    console.log("✅ Detalles eliminados (si existían)");

    // 2. Eliminamos mensajes del chat
    await prisma.chatMessage.deleteMany({
      where: { productoId: productId }
    });
    console.log("✅ Mensajes eliminados (si existían)");

    // 3. Desconectamos relaciones N:M de favoritos
    await prisma.product.update({
      where: { id: productId },
      data: {
        usuariosFavorito: {
          set: []
        }
      }
    });
    console.log("✅ Favoritos desconectados");

    // 4. Eliminamos el producto principal
    await prisma.product.delete({
      where: { id: productId }
    });
    console.log("🎉 ¡Producto eliminado con éxito de la base de datos!");

    res.status(200).json({ mensaje: "Publicación eliminada con éxito" });
  } catch (error) {
    console.error("❌ Error grave al eliminar producto en backend:", error);
    res.status(500).json({ error: "No se pudo eliminar el producto", detalles: error.message });
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