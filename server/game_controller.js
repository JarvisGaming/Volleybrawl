const { initialize, getIO, targetFPS, clamp, playerRadius, ballRadius, gamefieldWidth, gamefieldHeight } = require("./shared.js");

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
 * Information about a player's performance displayed at the end of a game.
 * @typedef {Object} PlayerStatistics
 * @property {Number} score
 * @property {Number} numJumps
 * @property {Number} numSmacks
 */

/**
 * @typedef {Object} GameState
 * @property {{
 *   player1: Position,
 *   player2: Position,
 *   ball: Position,
 *   net: Position
 * }} positions
 * @property {{
 *   player1: PlayerStatistics,
 *   player2: PlayerStatistics,
 * }} statistics
 * @property {{
 * 	 player1: Set<string>,
 * 	 player2: Set<string>,
 * }} inputs
 * Each set stores all the keys the player has pressed in between server ticks.
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
	const positions = {
		player1: {x: 100, y: 100, dx: 0, dy: 0},
		player2: {x: 700, y: 100, dx: 0, dy: 0},
		ball: {x: 200, y: 100, dx: 0, dy: 0},
		net: {x: 400, y: 350, dx: 0, dy: 0},
	};
	const statistics = {
		player1: {score: 0, numJumps: 0, numSmacks: 0},
		player2: {score: 0, numJumps: 0, numSmacks: 0},
	};
	const inputs = {
		player1: new Set(),
		player2: new Set(),
	};
	return {positions, statistics, inputs};
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
		players[socketID] = createGamePlayer(player.name, Object.keys(players).length + 1, gameID);
		games[gameID].players[socketID] = players[socketID];
	}

	console.dir({ games, players }, { depth: null });
};

function runGame(game){
	// Run game loop
	setInterval(doTick, 1000 / targetFPS, game);
}

// Process a server tick
function doTick(game){
	runPhysicsCalculations(game.state);
	updatePositions(game.state.positions);
	sendPositionsToClients(game.gameID, game.state.positions);
	getPlayerInputs(game.gameID);
}

/**
 * Update the velocities of all game objects.
 * @param {GameState} gameState
 */
function runPhysicsCalculations(gameState){
	function isGrounded(playerPosition){ return playerPosition.y + playerRadius >= gamefieldHeight; }
	function isMovingLeft(inputSet){ return inputSet.has("ArrowLeft"); }
	function isMovingRight(inputSet){ return inputSet.has("ArrowRight"); }
	function isJumping(inputSet){ return inputSet.has("ArrowUp"); }

	// Update player velocities
	for (const playerID of ["player1", "player2"]){
		const inputSet = gameState.inputs[playerID];

		// Handle horizontal movement

		if (isMovingLeft(inputSet)) gameState.positions[playerID].dx -= 5;
		if (isMovingRight(inputSet)) gameState.positions[playerID].dx += 5;

		// Friction
		gameState.positions[playerID].dx *= 0.6;

		// Handle vertical movement
		// If the player is on / in the ground, stop falling
		if (isGrounded(gameState.positions[playerID])) gameState.positions[playerID].dy = 0;

		// Jumping
		if (isJumping(inputSet) && isGrounded(gameState.positions[playerID])) gameState.positions[playerID].dy -= 20;

		// Gravity
		if (!isGrounded(gameState.positions[playerID])) gameState.positions[playerID].dy += 1;
	}
}

// Move the players, the net, and the ball based on velocity.
function updatePositions(positions){
	for (const interactable of Object.keys(positions)){
		positions[interactable].x += positions[interactable].dx;
		positions[interactable].y += positions[interactable].dy;
	}

	// Clamp player position to their side of the net
	positions["player1"].y = clamp(positions["player1"].y, playerRadius, gamefieldHeight - playerRadius);
	positions["player1"].x = clamp(positions["player1"].x, playerRadius, gamefieldWidth / 2 - playerRadius);

	positions["player2"].y = clamp(positions["player2"].y, playerRadius, gamefieldHeight - playerRadius);
	positions["player2"].x = clamp(positions["player2"].x, gamefieldWidth / 2 + playerRadius, gamefieldWidth - playerRadius);

	// Clamp ball position
}

function sendPositionsToClients(gameID, positions){
	getIO().to(gameID).emit("update_positions", positions);
}

// Sends an event to clients to get player input.
function getPlayerInputs(gameID){
	getIO().to(gameID).emit("collect_inputs");
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
			runGame(game);
		}

		console.dir({ games, players }, { depth: null });
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