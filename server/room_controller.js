const shared = require("./shared.js");
const crypto = require("crypto");
const gameController = require("./game_controller.js");
const MAX_PLAYERS_PER_ROOM = 2;

/**
 * Represents a connected client.
 * @typedef {Object} RoomPlayer
 * @property {string} name
 * @property {string|null} joinedRoomID - The roomID of the room the player has joined, or null if not in any room.
 * @property {boolean} ready - Whether the player is ready in the room they have joined. Meaningless if not in any room.
 */

/**
 * Represents an active room with at least 1 player inside.
 * @typedef {Object} Room
 * @property {string} roomID
 * @property {Object.<string, RoomPlayer>} players
 */

/**
 * Represents all rooms with at least 1 player inside.
 * Keys are roomIDs (UUID strings).
 * @type {Object.<string, Room>}
 */
const rooms = {};

/**
 * Represents all connected clients in the room listing screen.
 * Keys are (currently) socketIDs.
 * @type {Object.<string, RoomPlayer>}
 */
const players = {};

/**
 * Factory function to create a Player object.
 * @param {string} name 
 * @returns {RoomPlayer}
 */
const createPlayer = function(name) {
	return {
		name,
		joinedRoomID: null,
		ready: false,
	};
};

/**
 * Makes the current player leave an already joined room (if any).
 * @param {import("socket.io").Socket} socket 
 */
function leaveOldRoom(socket){
	const player = players[socket.id];

	const oldRoomID = player.joinedRoomID;
	const oldRoom = rooms[oldRoomID];
	player.joinedRoomID = null;

	// Check if player is currently in a room
	if (oldRoom != null){
		delete oldRoom.players[socket.id];

		// Delete room if there are no players in it
		if (Object.keys(oldRoom.players).length == 0) {
			delete rooms[oldRoomID];
		}
	}
}

/**
 * Makes the current player join a new room.
 * @param {import("socket.io").Socket} socket 
 * @param {string} roomID 
 */
function joinNewRoom(socket, roomID){
	const player = players[socket.id];

	const newRoom = rooms[roomID];
	newRoom.players[socket.id] = player;

	player.joinedRoomID = newRoom.roomID;
	player.ready = false;
}

/**
 * Start a new game with the players in the room, then delete the room.
 * @param {Room} room 
 */
function startGame(room) {
	// Add all players to socket room
	for (const socketID of Object.keys(room.players)) {
		const playerSocket = shared.getIO().sockets.sockets.get(socketID);
		playerSocket.join(room.roomID);
	}

	// Pass room ID to game controller to use as game ID
	gameController.createGame(room);

	// Make clients load game page
	shared.getIO().to(room.roomID).emit("game_start");

	// Delete the room
	delete rooms[room.roomID];
	shared.getIO().emit("update_rooms", rooms);

	// Remove players from player list in controller
	for (const socketID of Object.keys(room.players)) {
		delete players[socketID];
	}
}

const eventHandlers = {
	/**
	 * Event handler for entering the game listing page.
	 * @param {import("socket.io").Socket} socket 
	 * @param {string} playerName 
	 */
	enterRoomListingPage(socket, playerName) {
		players[socket.id] = createPlayer(playerName);
		socket.emit("enter_room_listing_page_success");
		socket.emit("update_rooms", rooms);

		console.dir({rooms, players}, { depth: null });
	},

	/**
	 * Event handler for creating a new room and adding the current player to it.
	 * @param {import("socket.io").Socket} socket 
	 */
	createRoom(socket) {
		const roomID = crypto.randomUUID();
		rooms[roomID] = { roomID: roomID, players: {} };

		leaveOldRoom(socket);
		joinNewRoom(socket, roomID);

		socket.emit("room_page_success", "Successfully created a new room.");
		shared.getIO().emit("update_rooms", rooms);

		console.dir({rooms, players}, { depth: null });
	},

	/**
	 * Event handler for adding a player to a specific room.
	 * @param {import("socket.io").Socket} socket 
	 * @param {string} roomID 
	 * @returns 
	 */
	joinRoom(socket, roomID) {
		const player = players[socket.id];
		if (player.joinedRoomID === roomID) {
			socket.emit("room_page_error", "You are already in this room.");
			return;
		}

		if (Object.keys(rooms[roomID].players).length >= MAX_PLAYERS_PER_ROOM) {
			socket.emit("room_page_error", "The room is full already.");
			return;
		}
		
		leaveOldRoom(socket);
		joinNewRoom(socket, roomID);

		socket.emit("room_page_success", "Successfully joined the room.");
		shared.getIO().emit("update_rooms", rooms);

		console.dir({rooms, players}, { depth: null });
	},

	/**
	 * Event handler for removing a player from a specific room.
	 * @param {import("socket.io").Socket} socket 
	 * @param {string} roomID 
	 * @returns 
	 */
	leaveRoom(socket, roomID) {
		const player = players[socket.id];
		if (player.joinedRoomID != roomID) {
			socket.emit("room_page_error", "You can't leave a room you haven't joined.");
			return;
		}

		leaveOldRoom(socket);

		socket.emit("room_page_success", "Successfully left the room.");
		shared.getIO().emit("update_rooms", rooms);

		console.dir({rooms, players}, { depth: null });
	},

	/**
	 * Event handler for toggling the ready status of a player in a specific room.
	 * @param {import("socket.io").Socket} socket 
	 * @param {string} roomID 
	 * @returns 
	 */
	readyUp(socket, roomID) {
		const player = players[socket.id];

		if (player.joinedRoomID != roomID) {
			socket.emit("room_page_error", "You can't ready up in a room you haven't joined.");
			return;
		}

		// Toggle ready status
		const room = rooms[roomID];
		room.players[socket.id].ready = !room.players[socket.id].ready;

		shared.getIO().emit("update_rooms", rooms);
		socket.emit("room_page_success", "You are " + (room.players[socket.id].ready ? "ready" : "not ready") + ".");

		// Start the game if all players are ready
		if (
			Object.keys(room.players).length == MAX_PLAYERS_PER_ROOM &&
			Object.values(room.players).every(player => player.ready)
		) {
			startGame(room);
		}

		console.dir({rooms, players}, { depth: null });
	},

	/**
	 * Event handler for handling the disconnection of a player who is currently in a room.
	 * @param {import("socket.io").Socket} socket 
	 */
	disconnectInRoom(socket) {
		if (!(socket.id in players)) return;

		const player = players[socket.id];
		if (!player.inGame) {
			leaveOldRoom(socket);
			delete players[socket.id];
			shared.getIO().emit("update_rooms", rooms);
		}

		console.dir({rooms, players}, { depth: null });
	},
};

module.exports = eventHandlers;