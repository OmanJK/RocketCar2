// Importer Socket.IO
// Socket.IO est chargé via le CDN dans index.html, l'objet 'io' est global
const io = window.io // Declare the io variable

console.log("[v0] Script controller.js chargé")
console.log("[v0] Socket.IO disponible:", typeof io !== "undefined")

// Connexion Socket.IO
const socket = io()

console.log("[v0] Tentative de connexion au serveur...")

// Éléments DOM
const statusText = document.getElementById("statusText")
const statusDot = document.querySelector(".status-dot")
const connectSection = document.getElementById("connectSection")
const controlsSection = document.getElementById("controlsSection")
const disconnectedOverlay = document.getElementById("disconnectedOverlay")
const autoConnectBtn = document.getElementById("autoConnectBtn")
const reconnectBtn = document.getElementById("reconnectBtn")
const scoreElement = document.getElementById("score")
const speedElement = document.getElementById("speed")

// Boutons de contrôle
const accelerateBtn = document.getElementById("accelerateBtn")
const leftBtn = document.getElementById("leftBtn")
const rightBtn = document.getElementById("rightBtn")

// Variables de contrôle
let isConnectedToDesktop = false
let controllerId = null

// Anti-rebond pour éviter les envois multiples
const buttonStates = {
  accelerate: false,
  left: false,
  right: false,
}

// Délai anti-ghost (en ms)
const DEBOUNCE_DELAY = 50
const lastActionTime = {
  accelerate: 0,
  left: 0,
  right: 0,
}

// Fonction pour envoyer une commande avec anti-rebond
function sendControl(action) {
  const now = Date.now()
  const actionKey = action.replace("-release", "")

  // Vérifier le délai anti-ghost
  if (now - lastActionTime[actionKey] < DEBOUNCE_DELAY) {
    return
  }

  lastActionTime[actionKey] = now

  // Envoyer la commande
  socket.emit("control", { action })

  // Vibration haptique si supportée
  if (navigator.vibrate && !action.includes("release")) {
    navigator.vibrate(20)
  }
}

// Gestion des boutons avec touch events pour mobile
function setupButton(button, action) {
  const actionKey = action.replace("-release", "")

  // Touch start
  button.addEventListener("touchstart", (e) => {
    e.preventDefault()
    if (!isConnectedToDesktop) return

    if (!buttonStates[actionKey]) {
      buttonStates[actionKey] = true
      button.classList.add("active")
      sendControl(action)
    }
  })

  // Touch end
  button.addEventListener("touchend", (e) => {
    e.preventDefault()
    if (!isConnectedToDesktop) return

    if (buttonStates[actionKey]) {
      buttonStates[actionKey] = false
      button.classList.remove("active")
      sendControl(action + "-release")
    }
  })

  // Touch cancel (si le doigt sort du bouton)
  button.addEventListener("touchcancel", (e) => {
    e.preventDefault()
    if (!isConnectedToDesktop) return

    if (buttonStates[actionKey]) {
      buttonStates[actionKey] = false
      button.classList.remove("active")
      sendControl(action + "-release")
    }
  })

  // Support pour le clic souris (test sur desktop)
  button.addEventListener("mousedown", (e) => {
    e.preventDefault()
    if (!isConnectedToDesktop) return

    if (!buttonStates[actionKey]) {
      buttonStates[actionKey] = true
      button.classList.add("active")
      sendControl(action)
    }
  })

  button.addEventListener("mouseup", (e) => {
    e.preventDefault()
    if (!isConnectedToDesktop) return

    if (buttonStates[actionKey]) {
      buttonStates[actionKey] = false
      button.classList.remove("active")
      sendControl(action + "-release")
    }
  })

  button.addEventListener("mouseleave", (e) => {
    if (!isConnectedToDesktop) return

    if (buttonStates[actionKey]) {
      buttonStates[actionKey] = false
      button.classList.remove("active")
      sendControl(action + "-release")
    }
  })
}

// Configurer les boutons
setupButton(accelerateBtn, "accelerate")
setupButton(leftBtn, "left")
setupButton(rightBtn, "right")

// Connexion automatique au premier desktop disponible
function connectToDesktop() {
  socket.emit("register-mobile")
}

autoConnectBtn.addEventListener("click", connectToDesktop)
reconnectBtn.addEventListener("click", () => {
  disconnectedOverlay.style.display = "none"
  connectToDesktop()
})

// Événements Socket.IO
socket.on("connect", () => {
  console.log("[v0] Connecté au serveur, ID:", socket.id)
  statusText.textContent = "Connecté"
  statusDot.classList.add("connected")
})

socket.on("registered", (data) => {
  console.log("[v0] Mobile enregistré:", data)
  controllerId = data.id
})

socket.on("available-desktops", (desktops) => {
  console.log("[v0] Desktops disponibles:", desktops)

  // Connexion automatique au premier desktop disponible
  if (desktops.length > 0) {
    socket.emit("connect-to-desktop", desktops[0].id)
  }
})

socket.on("desktop-available", (data) => {
  // Si on n'est pas connecté, se connecter automatiquement
  if (!isConnectedToDesktop) {
    socket.emit("connect-to-desktop", data.desktopId)
  }
})

socket.on("connected-to-desktop", (data) => {
  console.log("Connecté au desktop:", data)
  isConnectedToDesktop = true
  statusText.textContent = "Connecté au jeu"
  statusDot.classList.add("connected")

  // Afficher les contrôles
  connectSection.style.display = "none"
  controlsSection.style.display = "flex"

  // Vibration de confirmation
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100])
  }
})

socket.on("connection-failed", (data) => {
  console.log("Connexion échouée:", data)
  alert(data.message)
})

socket.on("desktop-disconnected", (data) => {
  console.log("Desktop déconnecté:", data)
  isConnectedToDesktop = false
  statusText.textContent = "Déconnecté"
  statusDot.classList.remove("connected")
  statusDot.classList.add("disconnected")

  // Afficher l'overlay de déconnexion
  disconnectedOverlay.style.display = "flex"

  // Réinitialiser tous les boutons
  Object.keys(buttonStates).forEach((key) => {
    buttonStates[key] = false
  })
  accelerateBtn.classList.remove("active")
  leftBtn.classList.remove("active")
  rightBtn.classList.remove("active")
})

socket.on("game-state", (state) => {
  // Mettre à jour les informations du jeu
  scoreElement.textContent = state.score || 0
  speedElement.textContent = state.speed || 0
})

socket.on("disconnect", () => {
  console.log("[v0] Déconnecté du serveur")
  isConnectedToDesktop = false
  statusText.textContent = "Déconnecté"
  statusDot.classList.remove("connected")
  statusDot.classList.add("disconnected")

  // Afficher l'overlay
  disconnectedOverlay.style.display = "flex"
})

// Empêcher le zoom sur double tap
document.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 1) {
      e.preventDefault()
    }
  },
  { passive: false },
)

let lastTouchEnd = 0
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      e.preventDefault()
    }
    lastTouchEnd = now
  },
  { passive: false },
)

// Empêcher le pull-to-refresh
document.body.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) {
      e.preventDefault()
    }
  },
  { passive: false },
)
