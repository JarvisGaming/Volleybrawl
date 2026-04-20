const { getIO, targetFPS, clamp, playerRadius, ballRadius, wallWidth, gamefieldWidth, gamefieldHeight } = require("./shared.js");

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
		ball: {x: 200, y: 100, dx: 20, dy: 0},
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

/**
 * Start the game loop.
 * @param {Game} game 
 */
function runGame(game){
	setInterval(doTick, 1000 / targetFPS, game);
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
}

/**
 * Update the velocities of all game objects.
 * @param {GameState} gameState
 */
function runPhysicsCalculations(gameState){
	function isGrounded(position, radius){ return position.y + radius >= gamefieldHeight; }
	
	function isMovingLeft(inputSet){ return inputSet.has("ArrowLeft"); }
	function isMovingRight(inputSet){ return inputSet.has("ArrowRight"); }
	function isJumping(inputSet){ return inputSet.has("ArrowUp"); }
	function isSmacking(inputSet){ return inputSet.has(" "); }

	function ballIsInSideWall(ballPosition){ return ballPosition.x - ballRadius <= 0 || ballPosition.x + ballRadius >= gamefieldWidth; }
	function ballIsInCeiling(ballPosition){ return ballPosition.y <= ballRadius; }
	function ballIsInNet(ballPosition, wallPosition){ 
		const ballIsUnderTopOfNet = ballPosition.y >= wallPosition.y;
		const ballIsCloseToLeftSideOfNet = Math.abs(ballPosition.x - (wallPosition.x - wallWidth / 2)) <= ballRadius / 2;
		const ballIsCloseToRightSideOfNet = Math.abs(ballPosition.x - (wallPosition.x + wallWidth / 2)) <= ballRadius / 2;

		// To prevent the ball from getting stuck in the net (bouncing between its two inner walls),
		// we check the direction that the ball is going
		if (ballPosition.dx > 0) return ballIsUnderTopOfNet && ballIsCloseToLeftSideOfNet;  // Moving right
		else return ballIsUnderTopOfNet && ballIsCloseToRightSideOfNet;  // Moving left
	}

	function isTouching(playerPosition, ballPosition){
		return Math.sqrt(
			(playerPosition.x - ballPosition.x) ** 2 + 
			(playerPosition.y - ballPosition.y) ** 2
		) < playerRadius + ballRadius;
	}

	// PHYSICS CALCULATIONS
	const inputs = gameState.inputs;
	const positions = gameState.positions;

	// Update player velocities
	for (const playerID of ["player1", "player2"]){
		const inputSet = inputs[playerID];

		// Handle horizontal movement
		if (isMovingLeft(inputSet)) positions[playerID].dx -= 5;
		if (isMovingRight(inputSet)) positions[playerID].dx += 5;

		// Friction
		positions[playerID].dx *= 0.6;

		// Handle vertical movement
		// If the player is on / in the ground, stop falling
		if (isGrounded(positions[playerID], playerRadius)) positions[playerID].dy = 0;

		// Jumping
		if (isJumping(inputSet) && isGrounded(positions[playerID], playerRadius)) positions[playerID].dy -= 30;

		// Gravity
		if (!isGrounded(positions[playerID], playerRadius)) positions[playerID].dy += 1.5;
	}

	// Update ball velocities
	// If the ball is on / in the ground, bounce perfectly elastically
	if (isGrounded(positions.ball, ballRadius)) positions.ball.dy *= -1;

	// Gravity
	if (!isGrounded(positions.ball, ballRadius)) positions.ball.dy += 1;

	// If the ball touches a side wall, bounce perfectly elastically
	if (ballIsInSideWall(positions.ball)) positions.ball.dx *= -1;

	// If the ball hits the ceiling, bounce perfectly elastically
	if (ballIsInCeiling(positions.ball)) positions.ball.dy *= -1;

	// If the ball touches a player, override the velocity entirely (send at a fixed speed, relative to angle between player and ball)
	for (const playerID of ["player1", "player2"]){
		const playerPosition = positions[playerID];
		const ballPosition = positions.ball;

		if (isTouching(playerPosition, ballPosition)){
			// Calculate angle between player and ball
			const angle = Math.atan2(ballPosition.y - playerPosition.y, ballPosition.x - playerPosition.x);

			// Bounce ball off of player
			const totalVelocity = isSmacking(inputs[playerID]) ? 40 : 25;
			ballPosition.dx = totalVelocity * Math.cos(angle);
			ballPosition.dy = totalVelocity * Math.sin(angle);

		}
	}

	// Ball always bounces off net elastically
	if (ballIsInNet(positions.ball, positions.net)) positions.ball.dx *= -1;
}

/**
 * Move the players, the net, and the ball based on velocity.
 * @param {Positions} positions 
 */
function updatePositions(positions){
	for (const interactable of Object.keys(positions)){
		positions[interactable].x += positions[interactable].dx;
		positions[interactable].y += positions[interactable].dy;
	}

	// Clamp player position to their side of the net
	positions["player1"].y = clamp(positions["player1"].y, playerRadius, gamefieldHeight - playerRadius);
	positions["player1"].x = clamp(positions["player1"].x, playerRadius, gamefieldWidth / 2 - wallWidth / 2 - playerRadius);

	positions["player2"].y = clamp(positions["player2"].y, playerRadius, gamefieldHeight - playerRadius);
	positions["player2"].x = clamp(positions["player2"].x, gamefieldWidth / 2 + wallWidth / 2 + playerRadius, gamefieldWidth - playerRadius);

	// Clamp ball position
	positions.ball.y = clamp(positions.ball.y, ballRadius, gamefieldHeight - ballRadius);
	positions.ball.x = clamp(positions.ball.x, 0 + ballRadius, gamefieldWidth - ballRadius);
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