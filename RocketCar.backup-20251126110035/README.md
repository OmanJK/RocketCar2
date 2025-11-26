# 🏎️ Jeu de Course 2D Contrôlé par Mobile

Projet de jeu web 2D inspiré des jeux d'arcade de conduite des années 80-90, modernisé avec un contrôle par smartphone via Socket.IO.

## 📋 Table des matières

- [Description](#description)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Lancement](#lancement)
- [Utilisation](#utilisation)
- [Architecture](#architecture)
- [Protocole d'événements](#protocole-dévénements)
- [Gestion des erreurs](#gestion-des-erreurs)
- [Limitations connues](#limitations-connues)
- [Structure du projet](#structure-du-projet)

## 🎮 Description

Ce projet permet de jouer à un jeu de course 2D où :
- L'**affichage du jeu** se fait sur un écran d'ordinateur (desktop)
- Le **contrôle** s'effectue via un smartphone qui agit comme manette
- La **communication** se fait en temps réel via WebSockets (Socket.IO)

Le joueur doit maintenir la voiture sur la route en évitant les bords tout en accélérant pour augmenter son score.

## 🛠️ Technologies

### Stack imposée
- **Frontend Desktop** : HTML5, CSS3, JavaScript (Canvas API)
- **Frontend Mobile** : HTML5, CSS3, JavaScript (Touch Events API)
- **Backend** : Node.js + Express
- **Communication** : Socket.IO (WebSockets)
- **Utilitaires** : QRCode.js pour la génération de QR codes

## 📦 Prérequis

- **Node.js** version 14.x ou supérieure
- **npm** version 6.x ou supérieure
- Un **réseau local (LAN)** pour connecter le mobile et le desktop
- Un **navigateur moderne** (Chrome, Firefox, Safari, Edge)
- Un **smartphone** avec navigateur web

## 🚀 Installation

1. Cloner le dépôt :
\`\`\`bash
git clone <url-du-repo>
cd mobile-controlled-racing-game
\`\`\`

2. Installer les dépendances :
\`\`\`bash
npm install
\`\`\`

## ▶️ Lancement

1. Démarrer le serveur :
\`\`\`bash
npm start
\`\`\`

2. Le serveur affichera les URLs d'accès :
\`\`\`
========================================
🎮 Serveur de jeu démarré !
========================================

📱 Accueil: http://192.168.1.X:3000
🖥️  Desktop: http://192.168.1.X:3000/desktop
📱 Mobile: http://192.168.1.X:3000/mobile

========================================
\`\`\`

3. Ouvrir la vue Desktop sur votre ordinateur
4. Scanner le QR code avec votre téléphone ou accéder directement à l'URL mobile
5. Le contrôleur mobile se connectera automatiquement au jeu

## 🎯 Utilisation

### Sur Desktop
1. Ouvrez `http://<votre-ip>:3000/desktop`
2. Un QR code s'affichera pour faciliter la connexion mobile
3. Attendez la connexion du contrôleur mobile
4. Le jeu démarre automatiquement une fois le contrôleur connecté

### Sur Mobile
1. Scannez le QR code OU accédez à `http://<votre-ip>:3000/mobile`
2. Cliquez sur "Connexion automatique"
3. Une fois connecté, utilisez les boutons pour contrôler :
   - **Accélérer** : Maintenir pour augmenter la vitesse
   - **Gauche** : Tourner à gauche (nécessite de la vitesse)
   - **Droite** : Tourner à droite (nécessite de la vitesse)

### Règles du jeu
- Maintenez le bouton "Accélérer" pour avancer
- La voiture ne peut tourner que si elle a de la vitesse
- Évitez de toucher les bords rouges de la route
- Votre score augmente en fonction de votre vitesse
- Le jeu se termine si vous sortez de la route

## 🏗️ Architecture

### Architecture Client-Serveur

\`\`\`
┌─────────────────┐                  ┌─────────────────┐
│   Client        │                  │   Client        │
│   Desktop       │                  │   Mobile        │
│  (Affichage)    │                  │  (Contrôleur)   │
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         │  WebSocket (Socket.IO)             │
         │                                    │
         └──────────┬─────────────────────────┘
                    │
              ┌─────▼──────┐
              │  Serveur   │
              │  Node.js   │
              │ Socket.IO  │
              └────────────┘
\`\`\`

### Flux de données

1. **Initialisation**
   - Desktop : se connecte et s'enregistre comme "affichage"
   - Mobile : se connecte et s'enregistre comme "contrôleur"
   - Serveur : génère un QR code pour faciliter la connexion

2. **Appairage**
   - Mobile demande la liste des desktops disponibles
   - Connexion automatique au premier desktop disponible
   - Confirmation de connexion envoyée aux deux parties

3. **Gameplay**
   - Mobile : envoie les actions (left, right, accelerate)
   - Serveur : valide et transmet au desktop correspondant
   - Desktop : applique les actions et met à jour le jeu
   - Desktop : envoie l'état du jeu (score, vitesse) au mobile

4. **Déconnexion**
   - Détection automatique des déconnexions
   - Notification aux parties concernées
   - Possibilité de reconnexion

## 📡 Protocole d'événements

### Événements Client → Serveur

#### Desktop
\`\`\`javascript
// Enregistrement
socket.emit('register-desktop', {})

// Mise à jour de l'état du jeu
socket.emit('game-state-update', {
  score: Number,
  speed: Number,
  carX: Number
})

// Ping pour mesure de latence
socket.emit('ping')
\`\`\`

#### Mobile
\`\`\`javascript
// Enregistrement
socket.emit('register-mobile', {})

// Connexion à un desktop
socket.emit('connect-to-desktop', desktopId)

// Envoi de commandes de contrôle
socket.emit('control', {
  action: 'left' | 'right' | 'accelerate' | 
          'left-release' | 'right-release' | 'accelerate-release'
})
\`\`\`

### Événements Serveur → Client

#### Vers Desktop
\`\`\`javascript
// Confirmation d'enregistrement
socket.on('registered', { type, id, message })

// Contrôleur connecté
socket.on('controller-connected', { controllerId, message })

// Réception d'input de contrôle
socket.on('control-input', { action, timestamp })

// Contrôleur déconnecté
socket.on('controller-disconnected', { message })

// Pong (réponse au ping)
socket.on('pong', { timestamp })
\`\`\`

#### Vers Mobile
\`\`\`javascript
// Confirmation d'enregistrement
socket.on('registered', { type, id })

// Liste des desktops disponibles
socket.on('available-desktops', [{ id }])

// Nouveau desktop disponible
socket.on('desktop-available', { desktopId })

// Connexion réussie
socket.on('connected-to-desktop', { desktopId, message })

// Échec de connexion
socket.on('connection-failed', { message })

// État du jeu
socket.on('game-state', { score, speed, carX })

// Desktop déconnecté
socket.on('desktop-disconnected', { message })
\`\`\`

## 🛡️ Gestion des erreurs

### Sécurité réseau
- **CORS** : Configuré pour accepter toutes les origines en développement
- **Validation des données** : Vérification des actions envoyées par le mobile
- **Actions autorisées** : Liste blanche des commandes acceptées

### Robustesse de connexion
- **Déconnexions** : Détection automatique et notification aux parties
- **Reconnexion** : Bouton de reconnexion sur mobile
- **Anti-ghost input** : Système de debouncing (50ms) pour éviter les répétitions
- **État des boutons** : Suivi de l'état pour éviter les doublons

### Gestion des erreurs
\`\`\`javascript
// Validation des actions
const validActions = [
  'left', 'right', 'accelerate',
  'left-release', 'right-release', 'accelerate-release'
];

if (!validActions.includes(data.action)) {
  console.warn(`Action invalide: ${data.action}`);
  return;
}
\`\`\`

### Latence
- **Mesure** : Ping/pong toutes les 2 secondes
- **Affichage** : Latence affichée sur desktop
- **Objectif** : < 150ms (généralement 10-50ms sur LAN)

## ⚠️ Limitations connues

1. **Réseau** : 
   - Nécessite que les appareils soient sur le même réseau local (LAN)
   - Pas de support NAT traversal (pas accessible depuis Internet sans configuration)

2. **Navigateurs** :
   - API Vibration non supportée sur iOS
   - Nécessite un navigateur moderne avec support WebSocket

3. **Gameplay** :
   - Pas de système d'obstacles pour l'instant
   - Pas de mode multi-joueurs (1 contrôleur par desktop)
   - Pas de sauvegarde du meilleur score

4. **Mobile** :
   - Fonctionne mieux en mode portrait
   - Nécessite d'empêcher la mise en veille

## 📁 Structure du projet

\`\`\`
mobile-controlled-racing-game/
├── server/
│   └── server.js              # Serveur Node.js + Socket.IO
├── public/
│   ├── index.html             # Page d'accueil
│   ├── desktop/
│   │   ├── index.html         # Interface desktop
│   │   ├── style.css          # Styles desktop
│   │   └── game.js            # Logique du jeu
│   └── mobile/
│       ├── index.html         # Interface mobile
│       ├── style.css          # Styles mobile
│       └── controller.js      # Logique contrôleur
├── package.json               # Dépendances npm
└── README.md                  # Ce fichier
\`\`\`

## 🎓 Crédits

Projet réalisé dans le cadre du cours B2 Info/Codage

## 📝 Licence

MIT
