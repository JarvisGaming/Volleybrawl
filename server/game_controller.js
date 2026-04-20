const shared = require("./shared.js");

/**
 * Represents a connected client.
 * @typedef {Object} GamePlayer
 * @property {string} name
 * @property {Number} playerID - Whether the player is player 1 or 2.
 * @property {string} joinedGameID - The gameID of the game the player has joined.
 * @property {boolean} ready - Whether the player has loaded the game. Meaningless if not in any game.
 */

/**
 * Represents the position and velocity of a player, the ball, or the net.
 * @typedef {Object} Position
 * @property {Number} x
 * @property {Number} y
 * @property {Number} dx
 * @property {Number} dy
 */

/**
 * Information about a player's performance displayed at the end of a game.
 * @typedef {Object} PlayerStatistics
 * @property {Number} score
 * @property {Number} numJumps
 * @property {Number} numSmacks
 */

/**
 * @typedef {Object} GameState
 * @property {Object.<string, Position>} positions
 * Stores the positions of both players, the ball, and the net.
 * Access player positions via socketID. Access the ball and net with `ball`, `net`.
 * @property {Object.<string, PlayerStatistics>} statistics
 * Keys are socketIDs.
 */

/**
 * Represents an active game with at least 1 player inside.
 * @typedef {Object} Game
 * @property {string} gameID
 * @property {Object.<string, GamePlayer>} players
 * @property {GameState} state
 */

/**
 * Represents all active games with at least 1 player inside.
 * Keys are gameIDs (UUID strings).
 * @type {Object.<string, Game>}
 */
const games = {};

/**
 * Represents all connected clients in the game screen.
 * Keys are socketIDs.
 * @type {Object.<string, GamePlayer>}
 */
const players = {};


/**
 * Factory function to create a GamePlayer object.
 * @param {string} name 
 * @returns {GamePlayer}
 */
function createPlayer(name, playerID, gameID) {
	return {
		name,
		playerID,
		joinedGameID: gameID,
		ready: false,
	};
}

/**
 * 
 * @returns {GameState}
 */
function initGameState(){
	return {};
}

/**
 * Creates a new game based on the provided room.
 * @param {Room} room 
 */
function createGame(room) {
	// Reuse roomID as gameID
	const gameID = room.roomID;
	games[gameID] = { gameID, players: {}, state: initGameState() };

	// Update player list in controller and game
	for (const [socketID, player] of Object.entries(room.players)) {
		players[socketID] = createPlayer(player.name, Object.keys(players).length + 1, gameID);
		games[gameID].players[socketID] = players[socketID];
	}

	console.dir({ games, players }, { depth: null });
};

function runGame(gameID){
	const initialPositions = {
		player1: {x: 100, y: 100, dx: 1, dy: 0},
		player2: {x: 700, y: 100, dx: -1, dy: 0},
		ball: {x: 400, y: 100, dx: 0, dy: 1},
		net: {x: 390, y: 300, dx: 0, dy: 1},
	};

	const game = games[gameID];
	game.state.positions = initialPositions;

	// Run game loop
	setInterval(doTick, 1000 / shared.targetFPS, game);
}

// Process a server tick
function doTick(game){
	updatePositions(game.state.positions);
	sendPositionsToClients(game.gameID, game.state.positions);
}

// Run physics calculations to update positions
function updatePositions(positions){
	for (const interactable of Object.keys(positions)){
		positions[interactable].x += positions[interactable].dx;
		positions[interactable].y += positions[interactable].dy;
	}
}

function sendPositionsToClients(gameID, positions){
	shared.getIO().to(gameID).emit("update_positions", positions);
	// console.dir(positions, { depth: null });
}

const eventHandlers = {
	/**
	 * Event handler for toggling the ready status of a player in a specific game.
	 * @param {import("socket.io").Socket} socket 
	 */
	gameLoaded(socket) {
		const player = players[socket.id];
		const game = games[player.joinedGameID];
		player.ready = true;

		// If both players are ready, start the game
		if (Object.values(game.players).every(player => player.ready)) {
			shared.getIO().to(game.gameID).emit("start_game");
			runGame(game.gameID);
		}

		console.dir({ games, players }, { depth: null });
	},
};

module.exports = { createGame, eventHandlers };