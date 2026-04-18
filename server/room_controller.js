/**
 * Controller for handling room listing page events and logic.
 */

const crypto = require("crypto");

/**
 * @typedef {Object} Room
 * @property {string} roomID
 * @property {Object.<string, Player>} players
 */

/**
 * Represents all rooms with at least 1 player inside.
 * Keys are roomIDs (UUID strings).
 * @type {Object.<string, Room>}
 */
let rooms = {};

/**
 * Represents a connected client.
 * @typedef {Object} Player
 * @property {string} name
 * @property {string|null} joinedRoomID - The roomID of the room the player has joined, or null if not in any room.
 * @property {boolean} ready - Whether the player is ready in the room they have joined. Meaningless if not in any room.
 * @property {boolean} inGame - Whether the player is currently in a game.
 */

/**
 * Factory function to create a Player object.
 * @param {string} name 
 * @returns {Player}
 */
const createPlayer = function(name) {
	return {
		name,
		joinedRoomID: null,
		ready: false,
		inGame: false
	};
};

/**
 * Makes the current player leave an already joined room (if any).
 * @param {import("socket.io").Socket} socket 
 * @param {Object.<string, Player>} players 
 */
function leaveOldRoom(socket, players){
	const player = players[socket.id];

	let oldRoomID = player.joinedRoomID;
	let oldRoom = rooms[oldRoomID];
	player.joinedRoomID = null;

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
 * @param {Object.<string, Player>} players 
 * @param {string} roomID 
 */
function joinNewRoom(socket, players, roomID){
	const player = players[socket.id];

	let newRoom = rooms[roomID];
	newRoom.players[socket.id] = player;

	player.joinedRoomID = newRoom.roomID;
	player.ready = false;
}

/**
 * Event handler for entering the game listing page.
 * @param {import("socket.io").Socket} socket 
 * @param {Object.<string, Player>} players 
 * @param {string} playerName 
 */
const enterRoomListingPage = function(socket, players, playerName) {
	players[socket.id] = createPlayer(playerName);
	socket.emit("join_success");
	socket.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

/**
 * Event handler for creating a new room and adding the current player to it.
 * @param {import("socket.io").Socket} socket 
 * @param {import("socket.io").Server} io 
 * @param {Object.<string, Player>} players 
 */
const createRoom = function(socket, io, players) {
	let roomID = crypto.randomUUID();
	rooms[roomID] = { roomID: roomID, players: {} };

	leaveOldRoom(socket, players);
	joinNewRoom(socket, players, roomID);

	socket.emit("room_page_success", "Successfully created a new room.");
	io.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

/**
 * Event handler for adding a player to a specific room.
 * @param {import("socket.io").Socket} socket 
 * @param {import("socket.io").Server} io 
 * @param {Object.<string, Player>} players 
 * @param {string} roomID 
 * @returns 
 */
const joinRoom = function(socket, io, players, roomID) {
	const player = players[socket.id];
	if (player.joinedRoomID === roomID) {
		socket.emit("room_page_error", "You are already in this room.");
		return;
	}

	if (Object.keys(rooms[roomID].players).length >= 2) {
		socket.emit("room_page_error", "The room is full already.");
		return;
	}
	
	leaveOldRoom(socket, players);
	joinNewRoom(socket, players, roomID);

	socket.emit("room_page_success", "Successfully joined the room.");
	io.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

/**
 * Event handler for removing a player from a specific room.
 * @param {import("socket.io").Socket} socket 
 * @param {import("socket.io").Server} io 
 * @param {Object.<string, Player>} players 
 * @param {string} roomID 
 * @returns 
 */
const leaveRoom = function(socket, io, players, roomID) {
	const player = players[socket.id];
	if (player.joinedRoomID != roomID) {
		socket.emit("room_page_error", "You can't leave a room you haven't joined.");
		return;
	}

	leaveOldRoom(socket, players);

	socket.emit("room_page_success", "Successfully left the room.");
	io.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

/**
 * Event handler for toggling the ready status of a player in a specific room.
 * @param {import("socket.io").Socket} socket 
 * @param {import("socket.io").Server} io 
 * @param {Object.<string, Player>} players 
 * @param {string} roomID 
 * @returns 
 */
const readyUp = function(socket, io, players, roomID) {
	const player = players[socket.id];
	if (player.joinedRoomID != roomID) {
		socket.emit("room_page_error", "You can't ready up in a room you haven't joined.");
		return;
	}

	let newRoom = rooms[roomID];
	newRoom.players[socket.id].ready = !newRoom.players[socket.id].ready;
	io.emit("update_rooms", rooms);
	socket.emit("room_page_success", "You are " + (newRoom.players[socket.id].ready ? "ready" : "not ready") + ".");

	console.dir({rooms, players}, { depth: null });
};

/**
 * Event handler for handling the disconnection of a player who is currently in a room.
 * @param {import("socket.io").Socket} socket 
 * @param {import("socket.io").Server} io 
 * @param {Object.<string, Player>} players 
 */
const disconnectInRoom = function(socket, io, players) {
	if (!(socket.id in players)) return;

	const player = players[socket.id];
	if (!player.inGame) {
		leaveOldRoom(socket, players);
		delete players[socket.id];
		io.emit("update_rooms", rooms);
	}

	console.dir({rooms, players}, { depth: null });
};

module.exports = { enterRoomListingPage, createRoom, joinRoom, leaveRoom, readyUp, disconnectInRoom };