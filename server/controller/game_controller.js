const { getIO, targetFPS, playerRadius, gamefieldHeight } = require("../shared.js");
const { runPhysicsCalculations, updatePositions, player1Scored, player2Scored } = require("../physics.js");

/**
 * Represents a connected client.
 * @typedef {Object} GamePlayer
 * @property {string} name
 * @property {"player1"|"player2"} playerID - Whether the player is player 1 or 2.
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
 * @typedef {Object} Positions
 * @property {Position} player1
 * @property {Position} player2
 * @property {Position} ball
 * @property {Position} net
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
 * @property {Positions} positions
 * @property {{
 *   player1: PlayerStatistics,
 *   player2: PlayerStatistics,
 * }} statistics
 * @property {{
 * 	 player1: Set<string>,
 * 	 player2: Set<string>,
 * }} inputs
 * Each set stores all the keys the player has pressed in between server ticks.
 * @property {{
 * 	 player1: Number,
 * 	 player2: Number,
 * }} lastSmack
 * A timestamp in milliseconds indicating the last successful smack.
 */

/**
 * Represents an active game with at least 1 player inside.
 * @typedef {Object} Game
 * @property {string} gameID
 * @property {Object.<string, GamePlayer>} players
 * @property {GameState} state
 * @property {NodeJS.Timeout} gameLoopIntervalID
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

const initialPositions = {
	player1: {x: 100, y: gamefieldHeight - playerRadius, dx: 0, dy: 0},
	player2: {x: 700, y: gamefieldHeight - playerRadius, dx: 0, dy: 0},
	ball: {x: 100, y: 100, dx: 0, dy: 0},
	net: {x: 400, y: 350, dx: 0, dy: 0.1},
};

/**
 * Factory function to create a GamePlayer object.
 * @param {string} name 
 * @param {1|2} ithPlayer
 * Whether the player is the 1st or the 2nd player.
 * @param {string} gameID 
 * @returns {GamePlayer}
 */
function createGamePlayer(name, ithPlayer, gameID) {
	return {
		name,
		playerID: `player${ithPlayer}`,
		joinedGameID: gameID,
		ready: false,
	};
}

/**
 * @returns {GameState}
 */
function initGameState(){
	const positions = structuredClone(initialPositions);  // Deep copy the object
	const statistics = {
		player1: {score: 0, numJumps: 0, numSmacks: 0},
		player2: {score: 0, numJumps: 0, numSmacks: 0},
	};
	const inputs = {
		player1: new Set(),
		player2: new Set(),
	};
	const lastSmack = {
		player1: 0,
		player2: 0,
	};
	return {positions, statistics, inputs, lastSmack};
}

/**
 * Creates a new game based on the provided room.
 * @param {Room} room 
 */
function createGame(room) {
	// Reuse roomID as gameID
	const gameID = room.roomID;
	games[gameID] = { gameID, players: {}, state: initGameState(), gameLoop: null };

	// Update player list in controller and game
	for (const [socketID, player] of Object.entries(room.players)) {
		players[socketID] = createGamePlayer(player.name, Object.keys(players).length + 1, gameID);
		games[gameID].players[socketID] = players[socketID];
	}

	console.dir({ games, players }, { depth: null });
};

/**
 * Start the game loop.
 * @param {Game} game 
 */
function startRound(game){
	game.state.positions = structuredClone(initialPositions);  // Deep copy the object
	game.gameLoopIntervalID = setInterval(doTick, 1000 / targetFPS, game);
}

/**
 * Stop the game loop.
 * @param {Game} game 
 */
function stopRound(game){
	clearInterval(game.gameLoopIntervalID);
}

/**
 * Process a server tick, performing physics calculations and 
 * sending back the updated position information to clients for rendering.
 * @param {Game} game 
 */
function doTick(game){
	runPhysicsCalculations(game.state);
	updatePositions(game.state.positions);
	sendPositionsToClients(game.gameID, game.state.positions);
	getPlayerInputs(game.gameID);
	processRoundEnd(game);
}

/**
 * Send updated game object positions to the two players in the game.
 * @param {string} gameID 
 * @param {Positions} positions 
 */
function sendPositionsToClients(gameID, positions){
	getIO().to(gameID).emit("update_positions", positions);
}

/**
 * Ask clients to send back player inputs.
 * @param {string} gameID 
 */
function getPlayerInputs(gameID){
	getIO().to(gameID).emit("collect_inputs");
}

/**
 * If the ball has hit the ground, award a point to the scoring player and start a new round.
 * @param {Game} game 
 */
function processRoundEnd(game){
	const positions = game.state.positions;
	const statistics = game.state.statistics;

	// Ball hasn't hit the ground yet
	if (!player1Scored(positions.ball) && !player2Scored(positions.ball)) return;

	if (player1Scored(positions.ball)) statistics.player1.score++;
	if (player2Scored(positions.ball)) statistics.player2.score++;
	
	// Stop game loop
	stopRound(game);

	// Send round end event
	getIO().to(game.gameID).emit("round_end", {
		player1Score: statistics.player1.score,
		player2Score: statistics.player2.score,
	});

	// Start another round
	startRound(game);
}

const eventHandlers = {
	/**
	 * Event handler for toggling the ready status of a player in a specific game.
	 * If both players are ready, run the game.
	 * @param {import("socket.io").Socket} socket 
	 */
	gameLoaded(socket){
		const player = players[socket.id];
		const game = games[player.joinedGameID];
		player.ready = true;

		// If both players are ready, start the game
		if (Object.values(game.players).every(player => player.ready)) {
			getIO().to(game.gameID).emit("start_game");
			startRound(game);
		}

		// console.dir({ games, players }, { depth: null });
	},

	/**
	 * Event handler to updated the game's state with the player's latest inputs.
	 * @param {import("socket.io").Socket} socket 
	 * @param {Set<string>} inputs 
	 */
	updatePlayerInputs(socket, inputs){
		const player = players[socket.id];
		const playerID = player.playerID;
		const game = games[player.joinedGameID];
		game.state.inputs[playerID] = inputs;

		// console.dir(game.state.inputs, { depth: null });
	}
};

module.exports = { createGame, eventHandlers };