
// IMPORTATION DE MODULES NECESSAIRES
const express = require('express'); //  Framework pour créer une application web
const { createServer } = require('node:http'); // Utilisé pour créer un serveur HTTP.
const { join } = require('node:path'); // Permet de manipuler les chemins de fichiers.
const { Server } = require('socket.io'); // Bibliothèque pour gérer les connexions WebSocket.
const { createAdapter } = require('@socket.io/redis-adapter'); // Permet d'utiliser Redis comme adaptateur pour gérer les messages entre plusieurs instances de Socket.IO.
const Redis = require('ioredis'); // Client Redis pour Node.js.



// INITIALISATION DE L'APPLICATION EXPRESS ET DU SERVEUR SOCKET.IO
// Création du serveur HTTP et configuration de Socket.IO avec les paramètres CORS
const app = express(); // Initialisation de l'application Express
const server = createServer(app);  //Serveur HTTP créé à partir de l'application Express. 
const io = new Server(server, { // io : Instance de Socket.IO attachée au serveur HTTP.
	cors: {
		origin: ['http://192.168.0.59:3001', 'http://192.168.0.59:8001'], // Configuration pour autoriser les connexions depuis des origines spécifiques (192.168.0.59:3001 et 192.168.0.59:8001).
		credentials: true,
	},
});

// CONFIGURATION DE L'ADAPTATEUR REDIS POUR SOCKET.IO
// Permet à Socket.IO de fonctionner avec Redis pour la gestion des messages entre plusieurs instances.
const pubClient = new Redis( // Client Redis pour publier les messages
	process.env.REDIS_URL || 'redis://192.168.0.59:6379'
);
const subClient = pubClient.duplicate(); // Client Redis pour s'abonner aux messages
io.adapter(createAdapter(pubClient, subClient)); //io.adapter : Utilise l'adaptateur Redis pour permettre la communication entre plusieurs instances de Socket.IO.



// GESTION DES MESSAGES PUBLIÉS PAR SYMFONY VIA REDIS
subClient.subscribe('symfony-notify'); // Abonnement au canal 'symfony-notify' pour recevoir les messages publiés par Symfony
subClient.on('message', (_, json) => {
	try {
		const msg = JSON.parse(json); // JSON.parse(json) : Convertit le message reçu (en JSON) en objet JavaScript.
		console.log('[REDIS] received', msg);
		const { event, payload, userId } = msg;
		const target = userId;
		if (target) {
			const room = `user:${target}`;
			console.log('[REDIS] sending to room', room);
			io.to(room).emit(event, payload);
		} else {
			io.emit(event, payload); // broadcast
		}
	} catch (e) {
		console.error('[REDIS] bad msg', e);
	}
});

// MIDDLEWARE D'AUTHENTIFICATION POUR SOCKET.IO
// Vérifie la présence d'un token dans la requête de connexion et associe l'utilisateur à une salle spécifique.
io.use((socket, next) => {
	const userId = socket.handshake.query.token;
	console.log(userId);
	if (!userId) return next(new Error('no token'));
	socket.userId = userId;
	socket.join(`user:${userId}`);
	next();
});

server.listen(3001, () => { //  Démarre le serveur HTTP sur le port 3001.
	console.log('server is running'); //  Affiche un message dans la console pour indiquer que le serveur est en cours d'exécution.
});
