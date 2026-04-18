const shared = require("./shared.js");

/**
 * Represents a connected client.
 * @typedef {Object} Player
 * @property {string} name
 * @property {string|null} joinedGameID - The gameID of the game the player has joined, or null if not in any game.
 */

/**
 * Represents an active game with at least 1 player inside.
 * @typedef {Object} Game
 * @property {string} gameID
 * @property {Object.<string, Player>} players
 */

/**
 * Represents all active games with at least 1 player inside.
 * Keys are gameIDs (UUID strings).
 * @type {Object.<string, Game>}
 */
const games = {};

/**
 * Represents all connected clients in the game screen.
 * Keys are (currently) socketIDs.
 * @type {Object.<string, Player>}
 */
const players = {};


/**
 * Creates a new game based on the provided room.
 * @param {Room} room 
 */
const createGame = function(room) {
	// Reuse roomID as gameID
	const gameID = room.roomID;
	games[gameID] = { gameID, players: {} };

	// Update player list in controller and game
	for (const [socketID, player] of Object.entries(room.players)) {
		players[socketID] = { name: player.name, joinedGameID: gameID };
		games[gameID].players[socketID] = players[socketID];
	}

	console.dir({ games, players }, { depth: null });
};

module.exports = { createGame };