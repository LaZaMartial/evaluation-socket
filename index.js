const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const app = express();
const server = createServer(app);
const io = new Server(server, {
	cors: {
		origin: ['http://192.168.0.59:3001', 'http://192.168.0.59:8001'],
		credentials: true,
	},
});

/* ---------- Redis ---------- */
const pubClient = new Redis(
	process.env.REDIS_URL || 'redis://192.168.0.59:6379'
);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

/* ---------- listen to Redis messages published by Symfony ---------- */
subClient.subscribe('symfony-notify');
subClient.on('message', (_, json) => {
	try {
		const msg = JSON.parse(json);
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

/* ---------- helper: put every socket in a room = userId ---------- */
io.use((socket, next) => {
	const userId = socket.handshake.query.token;
	console.log(userId);
	if (!userId) return next(new Error('no token'));
	socket.userId = userId;
	socket.join(`user:${userId}`);
	next();
});

server.listen(3001, () => {
	console.log('server is running');
});
