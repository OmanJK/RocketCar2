# Documentation Technique

## Vue d'ensemble

Ce document décrit l'architecture technique, les mécanismes de communication et les choix d'implémentation du jeu de course 2D contrôlé par mobile.

## Architecture technique

### Stack technologique

#### Backend (Serveur)
- **Node.js** : Runtime JavaScript côté serveur
- **Express** : Framework web pour servir les fichiers statiques
- **Socket.IO** : Bibliothèque WebSocket pour communication bidirectionnelle temps réel
- **QRCode** : Génération de QR codes pour faciliter la connexion mobile

#### Frontend Desktop
- **HTML5 Canvas** : Rendu 2D du jeu
- **JavaScript Vanilla** : Logique du jeu et gestion des événements
- **Socket.IO Client** : Communication avec le serveur

#### Frontend Mobile
- **HTML5/CSS3** : Interface utilisateur responsive
- **Touch Events API** : Gestion des interactions tactiles
- **Socket.IO Client** : Communication avec le serveur
- **Vibration API** : Retour haptique (si supporté)

### Choix d'implémentation

#### 1. Canvas vs DOM
**Choix** : Canvas API pour le rendu du jeu sur desktop

**Raisons** :
- Performance : Rendu 60 FPS fluide
- Contrôle précis du rendu pixel par pixel
- Meilleur pour les animations continues (défilement de route)
- Moins de reflows/repaints comparé au DOM

#### 2. Socket.IO vs WebSockets natifs
**Choix** : Socket.IO

**Raisons** :
- Fallback automatique si WebSocket non supporté
- Reconnexion automatique
- Gestion simplifiée des rooms et broadcasts
- Support des événements nommés
- Facilite le multiplexing

#### 3. Architecture événementielle
**Choix** : Communication basée sur des événements nommés

**Raisons** :
- Séparation claire des responsabilités
- Facilite l'ajout de nouvelles fonctionnalités
- Débogage simplifié (événements tracés dans la console)
- Pattern scalable pour extension future (multi-joueurs)

## Mécanismes d'état

### Gestion de l'état du jeu (Desktop)

\`\`\`javascript
const game = {
  // Position et dimensions
  carX: Number,           // Position X de la voiture
  carY: Number,           // Position Y de la voiture (fixe)
  carWidth: 50,
  carHeight: 80,
  
  // Physique
  speed: Number,          // Vitesse actuelle (0-15)
  maxSpeed: 15,
  acceleration: 0.3,      // Taux d'accélération
  deceleration: 0.15,     // Taux de décélération
  turnSpeed: Number,      // Vitesse de virage (-8 à +8)
  maxTurnSpeed: 8,
  
  // État des contrôles
  isAccelerating: Boolean,
  isTurningLeft: Boolean,
  isTurningRight: Boolean,
  
  // Jeu
  score: Number,
  isGameOver: Boolean,
  
  // Route
  roadOffset: Number,     // Position de défilement
  roadSpeed: Number,      // Vitesse de défilement
  roadWidth: 400,
  roadX: Number           // Position X de la route
}
\`\`\`

### Synchronisation client-serveur

#### Pattern de mise à jour

1. **Mobile → Serveur** : Événements de contrôle (press/release)
2. **Serveur → Desktop** : Transmission des commandes validées
3. **Desktop** : Application locale et calcul du nouvel état
4. **Desktop → Serveur** : Envoi périodique de l'état (100ms)
5. **Serveur → Mobile** : Broadcast de l'état pour affichage

\`\`\`
Mobile                Serveur              Desktop
  │                      │                     │
  │──control(left)──────>│                     │
  │                      │──control-input─────>│
  │                      │                     │ [Calcul local]
  │                      │<──game-state────────│
  │<─────game-state──────│                     │
  │                      │                     │
\`\`\`

### Anti-ghost input

Pour éviter les répétitions involontaires de commandes :

\`\`\`javascript
const DEBOUNCE_DELAY = 50; // ms
let lastActionTime = {
  accelerate: 0,
  left: 0,
  right: 0
};

function sendControl(action) {
  const now = Date.now();
  const actionKey = action.replace('-release', '');
  
  // Ignorer si trop rapide
  if (now - lastActionTime[actionKey] < DEBOUNCE_DELAY) {
    return;
  }
  
  lastActionTime[actionKey] = now;
  socket.emit('control', { action });
}
\`\`\`

## Physique du jeu

### Modèle de mouvement

#### Accélération
\`\`\`javascript
if (isAccelerating) {
  speed = Math.min(speed + acceleration, maxSpeed);
} else {
  speed = Math.max(speed - deceleration, 0);
}
\`\`\`

#### Virage
- **Virage progressif** : Le `turnSpeed` s'accumule progressivement
- **Dépendance à la vitesse** : Le virage n'est effectif que si `speed > 0`
- **Retour au centre** : Si aucun bouton n'est pressé, retour progressif à 0

\`\`\`javascript
if (speed > 0) {
  if (isTurningLeft) {
    turnSpeed = Math.max(turnSpeed - 0.5, -maxTurnSpeed);
  } else if (isTurningRight) {
    turnSpeed = Math.min(turnSpeed + 0.5, maxTurnSpeed);
  } else {
    // Retour progressif au centre
    if (turnSpeed > 0) turnSpeed = Math.max(turnSpeed - 0.5, 0);
    else if (turnSpeed < 0) turnSpeed = Math.min(turnSpeed + 0.5, 0);
  }
  
  // Application proportionnelle à la vitesse
  carX += turnSpeed * (speed / maxSpeed);
}
\`\`\`

#### Défilement de la route
\`\`\`javascript
roadSpeed = speed * 2;
roadOffset += roadSpeed;

// Reset pour boucle infinie
if (roadOffset > 100) {
  roadOffset = 0;
}
\`\`\`

### Détection de collision

\`\`\`javascript
const roadLeftEdge = roadX + 10;  // Bord gauche (après bordure rouge)
const roadRightEdge = roadX + roadWidth - 10;  // Bord droit

if (carX < roadLeftEdge || carX + carWidth > roadRightEdge) {
  gameOver();
}
\`\`\`

## Gestion des erreurs et sécurité

### Validation des données

#### Côté serveur
\`\`\`javascript
// Vérification du type
if (typeof data.action !== 'string') {
  console.warn(`Données invalides de ${socket.id}`);
  return;
}

// Liste blanche des actions
const validActions = [
  'left', 'right', 'accelerate',
  'left-release', 'right-release', 'accelerate-release'
];

if (!validActions.includes(data.action)) {
  console.warn(`Action invalide: ${data.action}`);
  return;
}
\`\`\`

### Gestion des déconnexions

\`\`\`javascript
socket.on('disconnect', () => {
  // Desktop déconnecté
  const game = games.get(socket.id);
  if (game && game.controller) {
    io.to(game.controller).emit('desktop-disconnected', {
      message: 'Le jeu a été déconnecté.'
    });
  }
  
  // Mobile déconnecté
  const controller = controllers.get(socket.id);
  if (controller && controller.connectedTo) {
    io.to(controller.connectedTo).emit('controller-disconnected', {
      message: 'Contrôleur mobile déconnecté.'
    });
  }
});
\`\`\`

### CORS et sécurité réseau

\`\`\`javascript
const io = new Server(server, {
  cors: {
    origin: "*",  // Développement : accepter toutes origines
    methods: ["GET", "POST"]
  }
});
\`\`\`

**Note de production** : En production, remplacer `"*"` par les domaines autorisés.

## Optimisations de performance

### 1. Game loop optimisé
\`\`\`javascript
gameLoop() {
  this.updatePhysics();  // Logique
  this.render();         // Rendu
  
  if (!this.isGameOver) {
    requestAnimationFrame(() => this.gameLoop());
  }
}
\`\`\`
Utilisation de `requestAnimationFrame` pour synchronisation avec le rafraîchissement de l'écran (60 FPS).

### 2. Limitation de la fréquence d'envoi
\`\`\`javascript
setInterval(() => {
  if (!game.isGameOver) {
    socket.emit('game-state-update', gameState);
  }
}, 100);  // 10 fois par seconde au lieu de 60
\`\`\`

### 3. Touch events optimisés
\`\`\`javascript
// Empêcher comportements par défaut
button.addEventListener('touchstart', (e) => {
  e.preventDefault();  // Évite le zoom, scroll, etc.
  // ...
});

// Désactivation du double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
});
\`\`\`

## Mesure de la latence

### Système de ping/pong

\`\`\`javascript
// Desktop
let lastPingTime = 0;
function measureLatency() {
  lastPingTime = Date.now();
  socket.emit('ping');
}

setInterval(measureLatency, 2000);

socket.on('pong', (data) => {
  const latency = Date.now() - lastPingTime;
  latencyElement.textContent = latency + ' ms';
});

// Serveur
socket.on('ping', () => {
  socket.emit('pong', { timestamp: Date.now() });
});
\`\`\`

## Extensions possibles

### 1. Multi-contrôleurs
- Modifier la structure pour supporter plusieurs contrôleurs par desktop
- Ajouter système de sélection de joueur (joueur 1, 2, etc.)

### 2. Obstacles
\`\`\`javascript
const obstacles = [
  { x: Number, y: Number, width: Number, height: Number }
];

// Dans render()
obstacles.forEach(obstacle => {
  // Dessiner obstacle
  // Vérifier collision avec voiture
});
\`\`\`

### 3. Mode hors-ligne
- Ajouter contrôles clavier pour test sans mobile
- Bouton de test dans l'interface desktop

### 4. Leaderboard
- Stocker les scores dans une base de données
- Afficher le top 10

## Tests recommandés

### Tests fonctionnels
1. Connexion desktop seul
2. Connexion mobile seul
3. Appairage desktop-mobile
4. Test de tous les boutons
5. Déconnexion volontaire mobile
6. Déconnexion volontaire desktop
7. Reconnexion après déconnexion
8. Test de latence (ping)
9. Game over (sortie de route)
10. Restart après game over

### Tests de robustesse
1. Déconnexion Wi-Fi pendant le jeu
2. Mise en veille du mobile
3. Changement d'onglet sur mobile
4. Spam des boutons (test anti-ghost)
5. Envoi de messages invalides (DevTools)

### Tests de performance
1. Mesure FPS desktop (doit être stable à 60)
2. Mesure latence (doit être < 150ms sur LAN)
3. Test batterie mobile (consommation)
4. Test avec réseau 4G partagé (latence)

## Conclusion

Cette architecture client-serveur basée sur Socket.IO offre une base solide pour un jeu temps réel contrôlé par mobile. Les choix techniques privilégient la simplicité, la maintenabilité et l'extensibilité tout en assurant de bonnes performances pour l'expérience utilisateur.
