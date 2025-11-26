#!/bin/bash

# Script de test du serveur
# Vérifie que le serveur démarre correctement

echo "🧪 Test du serveur..."

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

echo "✅ Node.js installé: $(node --version)"

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi

echo "✅ npm installé: $(npm --version)"

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Démarrer le serveur en arrière-plan
echo "🚀 Démarrage du serveur..."
node server/server.js &
SERVER_PID=$!

# Attendre que le serveur démarre
sleep 3

# Tester si le serveur répond
echo "🔍 Test de connexion..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Serveur accessible"
else
    echo "❌ Serveur non accessible"
    kill $SERVER_PID
    exit 1
fi

# Arrêter le serveur
echo "🛑 Arrêt du serveur..."
kill $SERVER_PID

echo "✅ Tous les tests sont passés !"
