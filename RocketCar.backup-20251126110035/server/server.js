const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const QRCode = require("qrcode")
const path = require("path")
const os = require("os")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

const PORT = process.env.PORT || 3000

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, "../public")))

// Routes pour les différentes interfaces
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"))
})

app.get("/desktop", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/desktop/index.html"))
})

app.get("/mobile", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/mobile/index.html"))
})

// Obtenir l'adresse IP locale
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address
      }
    }
  }
  return "localhost"
}

// Générer le QR code pour l'accès mobile
app.get("/qrcode", async (req, res) => {
  try {
    const localIP = getLocalIP()
    const mobileUrl = `http://${localIP}:${PORT}/mobile`
    const qrCodeDataUrl = await QRCode.toDataURL(mobileUrl)
    res.json({ qrCode: qrCodeDataUrl, url: mobileUrl })
  } catch (error) {
    console.error("Erreur génération QR code:", error)
    res.status(500).json({ error: "Erreur génération QR code" })
  }
})

// Gestion des connexions
const games = new Map() // stocke les sessions de jeu
const controllers = new Map() // stocke les contrôleurs mobiles

io.on("connection", (socket) => {
  console.log(`[SERVEUR] Nouvelle connexion: ${socket.id}`)

  // Enregistrement d'un affichage desktop
  socket.on("register-desktop", (data) => {
    console.log(`[SERVEUR] Desktop enregistré: ${socket.id}`)
    games.set(socket.id, {
      id: socket.id,
      type: "desktop",
      controller: null,
      gameState: {
        carX: 0,
        carY: 0,
        speed: 0,
        score: 0,
      },
    })

    socket.emit("registered", {
      type: "desktop",
      id: socket.id,
      message: "En attente d'un contrôleur mobile...",
    })

    // Informer tous les contrôleurs qu'un nouveau desktop est disponible
    io.emit("desktop-available", { desktopId: socket.id })
  })

  // Enregistrement d'un contrôleur mobile
  socket.on("register-mobile", (data) => {
    console.log(`[SERVEUR] Mobile enregistré: ${socket.id}`)
    controllers.set(socket.id, {
      id: socket.id,
      type: "mobile",
      connectedTo: null,
    })

    socket.emit("registered", {
      type: "mobile",
      id: socket.id,
    })

    // Envoyer la liste des desktops disponibles
    const availableDesktops = Array.from(games.values())
      .filter((game) => !game.controller)
      .map((game) => ({ id: game.id }))

    socket.emit("available-desktops", availableDesktops)
  })

  // Connexion d'un mobile à un desktop
  socket.on("connect-to-desktop", (desktopId) => {
    console.log(`[SERVEUR] Demande de connexion mobile ${socket.id} vers desktop ${desktopId}`)
    const game = games.get(desktopId)
    const controller = controllers.get(socket.id)

    if (game && controller && !game.controller) {
      game.controller = socket.id
      controller.connectedTo = desktopId

      // Notifier le desktop
      io.to(desktopId).emit("controller-connected", {
        controllerId: socket.id,
        message: "Contrôleur mobile connecté !",
      })

      // Notifier le mobile
      socket.emit("connected-to-desktop", {
        desktopId: desktopId,
        message: "Connecté au jeu !",
      })

      console.log(`Mobile ${socket.id} connecté au desktop ${desktopId}`)
    } else {
      socket.emit("connection-failed", {
        message: "Connexion impossible. Desktop non disponible.",
      })
    }
  })

  // Réception des commandes de contrôle
  socket.on("control", (data) => {
    const controller = controllers.get(socket.id)

    if (!controller || !controller.connectedTo) {
      return
    }

    // Validation basique des données
    if (typeof data.action !== "string") {
      console.warn(`Données de contrôle invalides de ${socket.id}`)
      return
    }

    const validActions = ["left", "right", "accelerate", "left-release", "right-release", "accelerate-release"]
    if (!validActions.includes(data.action)) {
      console.warn(`Action invalide: ${data.action}`)
      return
    }

    // Transmettre la commande au desktop associé
    io.to(controller.connectedTo).emit("control-input", {
      action: data.action,
      timestamp: Date.now(),
    })
  })

  // Mise à jour de l'état du jeu (depuis desktop)
  socket.on("game-state-update", (state) => {
    const game = games.get(socket.id)
    if (game) {
      game.gameState = state

      // Envoyer l'état au contrôleur mobile si connecté
      if (game.controller) {
        io.to(game.controller).emit("game-state", state)
      }
    }
  })

  // Déconnexion
  socket.on("disconnect", () => {
    console.log(`[SERVEUR] Déconnexion: ${socket.id}`)

    // Si c'est un desktop
    const game = games.get(socket.id)
    if (game) {
      if (game.controller) {
        // Notifier le contrôleur
        io.to(game.controller).emit("desktop-disconnected", {
          message: "Le jeu a été déconnecté.",
        })

        const controller = controllers.get(game.controller)
        if (controller) {
          controller.connectedTo = null
        }
      }
      games.delete(socket.id)
    }

    // Si c'est un mobile
    const controller = controllers.get(socket.id)
    if (controller) {
      if (controller.connectedTo) {
        const connectedGame = games.get(controller.connectedTo)
        if (connectedGame) {
          connectedGame.controller = null
          // Notifier le desktop
          io.to(controller.connectedTo).emit("controller-disconnected", {
            message: "Contrôleur mobile déconnecté.",
          })
        }
      }
      controllers.delete(socket.id)
    }
  })

  // Ping/Pong pour tester la latence
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() })
  })
})

server.listen(PORT, () => {
  const localIP = getLocalIP()
  console.log("\n========================================")
  console.log("🎮 Serveur de jeu démarré !")
  console.log("========================================")
  console.log(`\n📱 Accueil: http://${localIP}:${PORT}`)
  console.log(`🖥️  Desktop: http://${localIP}:${PORT}/desktop`)
  console.log(`📱 Mobile: http://${localIP}:${PORT}/mobile`)
  console.log("\n========================================\n")
})
