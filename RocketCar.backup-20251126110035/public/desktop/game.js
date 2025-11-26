// Connexion Socket.IO
const io = window.io // Declare the io variable before using it
const socket = io()

// Éléments DOM
const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")
const statusText = document.getElementById("statusText")
const statusDot = document.querySelector(".status-dot")
const qrSection = document.getElementById("qrSection")
const qrCode = document.getElementById("qrCode")
const qrUrl = document.getElementById("qrUrl")
const controlsInfo = document.getElementById("controlsInfo")
const scoreElement = document.getElementById("score")
const speedElement = document.getElementById("speed")
const latencyElement = document.getElementById("latency")
const gameOverElement = document.getElementById("gameOver")
const finalScoreElement = document.getElementById("finalScore")

// Configuration du canvas
canvas.width = 800
canvas.height = 600

// Variables du jeu
const game = {
  carX: canvas.width / 2 - 25,
  carY: canvas.height - 120,
  carWidth: 50,
  carHeight: 80,
  speed: 0,
  maxSpeed: 5,
  acceleration: 0.3,
  deceleration: 0.15,
  turnSpeed: 0,
  maxTurnSpeed: 8,
  score: 0,
  roadOffset: 0,
  roadSpeed: 0,
  isAccelerating: false,
  isTurningLeft: false,
  isTurningRight: false,
  isGameOver: false,
  roadWidth: 400,
  roadX: (canvas.width - 400) / 2,
  obstacles: [],
  obstacleSpawnTimer: 0,
  obstacleSpawnInterval: 80, // Frames entre chaque spawn

  init() {
    this.carX = canvas.width / 2 - this.carWidth / 2
    this.carY = canvas.height - 120
    this.speed = 0
    this.turnSpeed = 0
    this.score = 0
    this.roadOffset = 0
    this.roadSpeed = 0
    this.isGameOver = false
    this.isAccelerating = false
    this.isTurningLeft = false
    this.isTurningRight = false
    this.obstacles = []
    this.obstacleSpawnTimer = 0
    gameOverElement.classList.remove("show")
    this.gameLoop()
  },

  restart() {
    this.init()
  },

  spawnObstacle() {
    const lanes = 3 // Nombre de voies sur la route
    const laneWidth = (this.roadWidth - 20) / lanes
    const randomLane = Math.floor(Math.random() * lanes)
    const obstacleX = this.roadX + 10 + randomLane * laneWidth + laneWidth / 2 - 25

    this.obstacles.push({
      x: obstacleX,
      y: -100, // Apparaît en haut de l'écran
      width: 50,
      height: 80,
      speed: 3 + Math.random() * 2, // Vitesse variable
      color: ["#3498db", "#9b59b6", "#f39c12", "#1abc9c"][Math.floor(Math.random() * 4)],
    })
  },

  updateObstacles() {
    // Spawner de nouveaux obstacles
    this.obstacleSpawnTimer++
    if (this.obstacleSpawnTimer > this.obstacleSpawnInterval && this.speed > 0) {
      this.spawnObstacle()
      this.obstacleSpawnTimer = 0
      // Augmenter la difficulté progressivement
      this.obstacleSpawnInterval = Math.max(40, 80 - Math.floor(this.score / 500))
    }

    // Déplacer les obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i]
      obstacle.y += obstacle.speed + this.roadSpeed / 2

      // Supprimer les obstacles hors écran
      if (obstacle.y > canvas.height) {
        this.obstacles.splice(i, 1)
        continue
      }

      // Détecter collision avec le joueur
      if (
        this.checkCollision(
          this.carX,
          this.carY,
          this.carWidth,
          this.carHeight,
          obstacle.x,
          obstacle.y,
          obstacle.width,
          obstacle.height,
        )
      ) {
        this.gameOver()
      }
    }
  },

  checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
  },

  updatePhysics() {
    if (this.isGameOver) return

    // Accélération
    if (this.isAccelerating) {
      this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed)
    } else {
      this.speed = Math.max(this.speed - this.deceleration, 0)
    }

    // Direction (seulement si la voiture avance)
    if (this.speed > 0) {
      if (this.isTurningLeft) {
        this.turnSpeed = Math.max(this.turnSpeed - 0.5, -this.maxTurnSpeed)
      } else if (this.isTurningRight) {
        this.turnSpeed = Math.min(this.turnSpeed + 0.5, this.maxTurnSpeed)
      } else {
        // Retour au centre progressif
        if (this.turnSpeed > 0) {
          this.turnSpeed = Math.max(this.turnSpeed - 0.5, 0)
        } else if (this.turnSpeed < 0) {
          this.turnSpeed = Math.min(this.turnSpeed + 0.5, 0)
        }
      }

      // Appliquer le virage
      this.carX += this.turnSpeed * (this.speed / this.maxSpeed)
    } else {
      this.turnSpeed = 0
    }

    // Vitesse de défilement de la route
    this.roadSpeed = this.speed * 2
    this.roadOffset += this.roadSpeed
    if (this.roadOffset > 100) {
      this.roadOffset = 0
    }

    // Incrémenter le score
    if (this.speed > 0) {
      this.score += Math.floor(this.speed / 2)
    }

    const roadLeftEdge = this.roadX + 10
    const roadRightEdge = this.roadX + this.roadWidth - 10

    // Empêcher la voiture de sortir de la route (mur invisible)
    if (this.carX < roadLeftEdge) {
      this.carX = roadLeftEdge
      this.turnSpeed = 0
    }
    if (this.carX + this.carWidth > roadRightEdge) {
      this.carX = roadRightEdge - this.carWidth
      this.turnSpeed = 0
    }

    this.updateObstacles()

    // Mise à jour de l'affichage
    scoreElement.textContent = Math.floor(this.score)
    speedElement.textContent = Math.floor(this.speed * 10)
  },

  gameOver() {
    if (this.isGameOver) return

    this.isGameOver = true
    this.speed = 0
    this.turnSpeed = 0
    finalScoreElement.textContent = Math.floor(this.score)
    gameOverElement.classList.add("show")
  },

  drawRoad() {
    // Fond d'herbe
    ctx.fillStyle = "#2ecc71"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Route principale
    ctx.fillStyle = "#34495e"
    ctx.fillRect(this.roadX, 0, this.roadWidth, canvas.height)

    // Bordures de la route
    ctx.fillStyle = "#e74c3c"
    ctx.fillRect(this.roadX, 0, 10, canvas.height)
    ctx.fillRect(this.roadX + this.roadWidth - 10, 0, 10, canvas.height)

    // Lignes pointillées au centre
    ctx.fillStyle = "#f1c40f"
    const lineWidth = 10
    const lineHeight = 40
    const lineGap = 30
    const centerX = this.roadX + this.roadWidth / 2 - lineWidth / 2

    for (
      let y = -lineHeight + (this.roadOffset % (lineHeight + lineGap));
      y < canvas.height;
      y += lineHeight + lineGap
    ) {
      ctx.fillRect(centerX, y, lineWidth, lineHeight)
    }
  },

  drawObstacles() {
    this.obstacles.forEach((obstacle) => {
      // Corps de la voiture obstacle
      ctx.fillStyle = obstacle.color
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)

      // Toit plus foncé
      const darkerColor = this.darkenColor(obstacle.color, 20)
      ctx.fillStyle = darkerColor
      ctx.fillRect(obstacle.x + 5, obstacle.y + 40, obstacle.width - 10, 30)

      // Fenêtres
      ctx.fillStyle = "#ecf0f1"
      ctx.fillRect(obstacle.x + 10, obstacle.y + 45, obstacle.width - 20, 20)

      // Roues
      ctx.fillStyle = "#2c3e50"
      ctx.fillRect(obstacle.x - 5, obstacle.y + 10, 8, 20)
      ctx.fillRect(obstacle.x + obstacle.width - 3, obstacle.y + 10, 8, 20)
      ctx.fillRect(obstacle.x - 5, obstacle.y + 50, 8, 20)
      ctx.fillRect(obstacle.x + obstacle.width - 3, obstacle.y + 50, 8, 20)

      // Feux arrière rouges
      ctx.fillStyle = "#e74c3c"
      ctx.fillRect(obstacle.x + 10, obstacle.y, 10, 8)
      ctx.fillRect(obstacle.x + obstacle.width - 20, obstacle.y, 10, 8)
    })
  },

  darkenColor(color, percent) {
    const num = Number.parseInt(color.replace("#", ""), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) - amt
    const G = ((num >> 8) & 0x00ff) - amt
    const B = (num & 0x0000ff) - amt
    return (
      "#" +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    )
  },

  drawCar() {
    // Corps de la voiture
    ctx.fillStyle = "#e74c3c"
    ctx.fillRect(this.carX, this.carY, this.carWidth, this.carHeight)

    // Toit
    ctx.fillStyle = "#c0392b"
    ctx.fillRect(this.carX + 5, this.carY + 10, this.carWidth - 10, 30)

    // Fenêtres
    ctx.fillStyle = "#3498db"
    ctx.fillRect(this.carX + 10, this.carY + 15, this.carWidth - 20, 20)

    // Roues
    ctx.fillStyle = "#2c3e50"
    ctx.fillRect(this.carX - 5, this.carY + 10, 8, 20)
    ctx.fillRect(this.carX + this.carWidth - 3, this.carY + 10, 8, 20)
    ctx.fillRect(this.carX - 5, this.carY + 50, 8, 20)
    ctx.fillRect(this.carX + this.carWidth - 3, this.carY + 50, 8, 20)

    // Phares
    if (this.speed > 5) {
      ctx.fillStyle = "#f1c40f"
      ctx.fillRect(this.carX + 10, this.carY + this.carHeight - 5, 10, 8)
      ctx.fillRect(this.carX + this.carWidth - 20, this.carY + this.carHeight - 5, 10, 8)
    }
  },

  render() {
    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Dessiner les éléments
    this.drawRoad()
    this.drawObstacles()
    this.drawCar()

    // Indicateur de vitesse visuel
    if (this.speed > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  },

  gameLoop() {
    this.updatePhysics()
    this.render()

    if (!this.isGameOver) {
      requestAnimationFrame(() => this.gameLoop())
    }
  },

  handleControl(action) {
    switch (action) {
      case "accelerate":
        this.isAccelerating = true
        break
      case "accelerate-release":
        this.isAccelerating = false
        break
      case "left":
        this.isTurningLeft = true
        this.isTurningRight = false
        break
      case "left-release":
        this.isTurningLeft = false
        break
      case "right":
        this.isTurningRight = true
        this.isTurningLeft = false
        break
      case "right-release":
        this.isTurningRight = false
        break
    }
  },
}

// Gestion de la latence
let lastPingTime = 0
function measureLatency() {
  lastPingTime = Date.now()
  socket.emit("ping")
}

setInterval(measureLatency, 2000)

// Événements Socket.IO
socket.on("connect", () => {
  console.log("Connecté au serveur")
  statusText.textContent = "Connecté au serveur"
  statusDot.classList.add("connected")
  socket.emit("register-desktop")

  // Charger le QR code
  fetch("/qrcode")
    .then((res) => res.json())
    .then((data) => {
      qrCode.src = data.qrCode
      qrUrl.textContent = data.url
    })
    .catch((err) => console.error("Erreur chargement QR code:", err))
})

socket.on("registered", (data) => {
  console.log("Desktop enregistré:", data)
})

socket.on("controller-connected", (data) => {
  console.log("Contrôleur connecté:", data)
  statusText.textContent = "Contrôleur mobile connecté - Prêt à jouer!"
  statusDot.classList.remove("connected")
  statusDot.classList.add("controller-connected")
  qrSection.classList.add("hidden")
  controlsInfo.classList.add("hidden")

  // Démarrer le jeu
  game.init()
})

socket.on("control-input", (data) => {
  game.handleControl(data.action)
})

socket.on("controller-disconnected", (data) => {
  console.log("Contrôleur déconnecté:", data)
  statusText.textContent = "Contrôleur déconnecté - En attente..."
  statusDot.classList.remove("controller-connected")
  statusDot.classList.add("connected")
  qrSection.classList.remove("hidden")
  controlsInfo.classList.remove("hidden")
  game.isGameOver = true
})

socket.on("pong", (data) => {
  const latency = Date.now() - lastPingTime
  latencyElement.textContent = latency + " ms"
})

socket.on("disconnect", () => {
  console.log("Déconnecté du serveur")
  statusText.textContent = "Déconnecté du serveur"
  statusDot.classList.remove("connected", "controller-connected")
})

// Envoyer périodiquement l'état du jeu
setInterval(() => {
  if (!game.isGameOver) {
    socket.emit("game-state-update", {
      score: Math.floor(game.score),
      speed: Math.floor(game.speed * 10),
      carX: game.carX,
    })
  }
}, 100)
