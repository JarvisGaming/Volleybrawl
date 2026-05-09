const { getIO, allPlayersAreReady, TARGET_FPS, PLAYER_RADIUS, GAMEFIELD_HEIGHT, NUM_POINTS_TO_WIN, SMACK_COOLDOWN_MILLI } = require("../shared.js");
const { runPhysicsCalculations, updatePositions, player1Scored, player2Scored } = require("../physics.js");

const ROUND_COUNTDOWN_VALUES = ["3", "2", "1", "GO!"];
const ROUND_COUNTDOWN_STEP_MILLI = 750;
const NEXT_ROUND_DELAY_MILLI = 1400;
const GAME_OVER_SEQUENCE_MILLI = 2200;

/**
 * Represents a connected client.
 * @typedef {Object} GamePlayer
 * @property {string} name
 * @property {"player1"|"player2"} playerID - Whether the player is player 1 or 2.
 * @property {string} joinedGameID - The gameID of the game the player has joined.
 * @property {boolean} ready - Whether the player has loaded the game and is ready to start / restart. Meaningless if not in any game.
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
 * @property {{ player1: PlayerStatistics, player2: PlayerStatistics }} statistics
 * @property {{ player1: Set<string>, player2: Set<string> }} inputs
 * @property {{ player1: Number, player2: Number }} lastSmack
 * @property {{ player1: boolean, player2: boolean }} cheatMode
 * @property {{ player1: Number, player2: Number }} lastContactSound
 * @property {{ player1: { toggleDown: boolean, pointDown: boolean }, player2: { toggleDown: boolean, pointDown: boolean } }} cheatInputState
 * @property {{ facing: { player1: "left"|"right", player2: "left"|"right" }, smackEffectUntil: { player1: Number, player2: Number } }} visualState
 * @property {Array<{ type: string, playerID?: "player1"|"player2", time?: Number }>} soundEvents
 */

/**
 * Represents an active game with at least 1 player inside.
 * @typedef {Object} Game
 * @property {string} gameID
 * @property {Object.<string, GamePlayer>} players
 * @property {GameState} state
 * @property {NodeJS.Timeout|null} gameLoopIntervalID
 * @property {NodeJS.Timeout[]} scheduledTimeoutIDs
 */

/** @type {Object.<string, Game>} */
const games = {};
/** @type {Object.<string, GamePlayer>} */
const players = {};

const initialPositions = {
	player1: {x: 100, y: GAMEFIELD_HEIGHT - PLAYER_RADIUS, dx: 0, dy: 0},
	player2: {x: 700, y: GAMEFIELD_HEIGHT - PLAYER_RADIUS, dx: 0, dy: 0},
	ball: {x: 100, y: 100, dx: 0, dy: 0},
	net: {x: 400, y: 350, dx: 0, dy: 0.1},
};

/**
 * @param {string} name
 * @param {1|2} ithPlayer
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

/** @returns {GameState} */
function initGameState(){
	const positions = structuredClone(initialPositions);
	const statistics = {
		player1: {score: 0, numJumps: 0, numSmacks: 0},
		player2: {score: 0, numJumps: 0, numSmacks: 0},
	};
	const inputs = { player1: new Set(), player2: new Set() };
	const lastSmack = { player1: 0, player2: 0 };
	const cheatMode = { player1: false, player2: false };
	const lastContactSound = { player1: 0, player2: 0 };
	const cheatInputState = {
		player1: { toggleDown: false, pointDown: false },
		player2: { toggleDown: false, pointDown: false },
	};
	const visualState = {
		facing: { player1: "right", player2: "left" },
		smackEffectUntil: { player1: 0, player2: 0 },
	};
	const soundEvents = [];
	return {positions, statistics, inputs, lastSmack, cheatMode, lastContactSound, cheatInputState, visualState, soundEvents};
}

/**
 * Creates a new game based on the provided room.
 * @param {Room} room
 */
function createGame(room) {
	const gameID = room.roomID;
	games[gameID] = {
		gameID,
		players: {},
		state: initGameState(),
		gameLoopIntervalID: null,
		scheduledTimeoutIDs: [],
	};

	let playerIndex = 1;
	for (const [socketID, player] of Object.entries(room.players)) {
		players[socketID] = createGamePlayer(player.name, playerIndex, gameID);
		games[gameID].players[socketID] = players[socketID];
		playerIndex++;
	}
}

/**
 * @param {Game} game
 */
function clearScheduledTimeouts(game){
	for (const timeoutID of game.scheduledTimeoutIDs) clearTimeout(timeoutID);
	game.scheduledTimeoutIDs = [];
}

/**
 * @param {Game} game
 * @param {number} delayMilli
 * @param {() => void} callback
 */
function scheduleForGame(game, delayMilli, callback){
	const timeoutID = setTimeout(() => {
		game.scheduledTimeoutIDs = game.scheduledTimeoutIDs.filter((id) => id !== timeoutID);
		callback();
	}, delayMilli);
	game.scheduledTimeoutIDs.push(timeoutID);
}

/**
 * @param {Game} game
 * @returns {{ player1: string, player2: string }}
 */
function getPlayerNames(game) {
	const playerNames = { player1: "", player2: "" };
	for (const player of Object.values(game.players)) {
		playerNames[player.playerID] = player.name;
	}
	return playerNames;
}

/**
 * Reset only per-round state while preserving score, stats, and cheat mode.
 * @param {Game} game
 */
function resetRoundState(game){
	game.state.positions = structuredClone(initialPositions);
	game.state.inputs = { player1: new Set(), player2: new Set() };
	game.state.lastSmack = { player1: 0, player2: 0 };
	game.state.lastContactSound = { player1: 0, player2: 0 };
	game.state.cheatInputState = {
		player1: { toggleDown: false, pointDown: false },
		player2: { toggleDown: false, pointDown: false },
	};
	game.state.visualState = {
		facing: { player1: "right", player2: "left" },
		smackEffectUntil: { player1: 0, player2: 0 },
	};
	game.state.soundEvents = [];
}

/**
 * Handle the cases where the player readies up by loading in the game,
 * and by clicking the restart button at the end of a game.
 * @param {import("socket.io").Socket} socket
 * @param {Boolean} resetState
 */
function handlePlayerReady(socket, resetState){
	const player = players[socket.id];
	if (!player) return;
	const game = games[player.joinedGameID];
	if (!game) return;

	player.ready = true;
	socket.emit("game_identity", { playerID: player.playerID });

	if (allPlayersAreReady(game.players)) {
		stopRound(game);
		clearScheduledTimeouts(game);
		if (resetState === true){
			game.state = initGameState();
		}

		const playerNames = getPlayerNames(game);
		getIO().to(game.gameID).emit("start_game", { playerNames });
		startRoundSequence(game, {
			phase: "match_start",
			title: "Players Ready!",
			subtitle: "Get ready for the serve",
		});
	}
}

/**
 * Start the active physics loop immediately.
 * @param {Game} game
 */
function startRound(game){
	if (game.gameLoopIntervalID !== null) stopRound(game);
	game.gameLoopIntervalID = setInterval(doTick, 1000 / TARGET_FPS, game);
}

/**
 * Stop the game loop.
 * @param {Game} game
 */
function stopRound(game){
	if (game.gameLoopIntervalID !== null) {
		clearInterval(game.gameLoopIntervalID);
		game.gameLoopIntervalID = null;
	}
}

function inputHasAny(inputSet, keys){
	return keys.some((key) => inputSet.has(key));
}

/**
 * Convert the physics state into a client render payload that includes drawing metadata.
 * @param {GameState} gameState
 */
function buildRenderState(gameState){
	const now = Date.now();
	const renderState = structuredClone(gameState.positions);

	for (const playerID of ["player1", "player2"]) {
		renderState[playerID].facing = gameState.visualState.facing[playerID];
		renderState[playerID].smacking = gameState.visualState.smackEffectUntil[playerID] > now;
		renderState[playerID].cheatMode = gameState.cheatMode[playerID];
		renderState[playerID].smackCooldownRemaining = Math.max(0, SMACK_COOLDOWN_MILLI - (now - gameState.lastSmack[playerID]));
		renderState[playerID].score = gameState.statistics[playerID].score;
	}

	renderState.meta = {
		cheatMode: { ...gameState.cheatMode },
		scores: {
			player1: gameState.statistics.player1.score,
			player2: gameState.statistics.player2.score,
		},
		smackCooldownMilli: SMACK_COOLDOWN_MILLI,
	};
	renderState.soundEvents = gameState.soundEvents.splice(0);

	return renderState;
}

/**
 * Send updated game object positions to the two players in the game.
 * @param {string} gameID
 * @param {GameState} gameState
 */
function sendPositionsToClients(gameID, gameState){
	getIO().to(gameID).emit("update_positions", buildRenderState(gameState));
}

/**
 * Emit the pre-round countdown and begin the round after it finishes.
 * @param {Game} game
 * @param {{ phase: string, title: string, subtitle: string }} payload
 */
function startRoundSequence(game, payload){
	stopRound(game);
	clearScheduledTimeouts(game);
	resetRoundState(game);
	sendPositionsToClients(game.gameID, game.state);

	getIO().to(game.gameID).emit("round_prepare", {
		...payload,
		countdownValues: ROUND_COUNTDOWN_VALUES,
		stepDurationMilli: ROUND_COUNTDOWN_STEP_MILLI,
		player1Score: game.state.statistics.player1.score,
		player2Score: game.state.statistics.player2.score,
	});

	scheduleForGame(game, ROUND_COUNTDOWN_VALUES.length * ROUND_COUNTDOWN_STEP_MILLI, () => {
		if (!(game.gameID in games)) return;
		startRound(game);
	});
}

/**
 * Handle edge-triggered cheat controls. Returns the scoring player when P awards a point.
 * @param {Game} game
 * @returns {"player1"|"player2"|null}
 */
function processCheatInputs(game){
	let scoringPlayerID = null;

	for (const playerID of ["player1", "player2"]) {
		const inputSet = game.state.inputs[playerID];
		const keyState = game.state.cheatInputState[playerID];

		const toggleDown = inputHasAny(inputSet, ["f", "F"]);
		if (toggleDown && !keyState.toggleDown) {
			game.state.cheatMode[playerID] = !game.state.cheatMode[playerID];
			game.state.soundEvents.push({
				type: game.state.cheatMode[playerID] ? "cheat_on" : "cheat_off",
				playerID,
				time: Date.now(),
			});
		}
		keyState.toggleDown = toggleDown;

		const pointDown = inputHasAny(inputSet, ["p", "P"]);
		if (game.state.cheatMode[playerID] && pointDown && !keyState.pointDown) {
			scoringPlayerID = playerID;
		}
		keyState.pointDown = pointDown;
	}

	return scoringPlayerID;
}

/**
 * Award a point and either begin a new round or finish the game.
 * @param {Game} game
 * @param {"player1"|"player2"} scoringPlayerID
 * @param {"regular"|"cheat"} reason
 */
function awardPoint(game, scoringPlayerID, reason){
	const statistics = game.state.statistics;
	statistics[scoringPlayerID].score++;

	stopRound(game);
	clearScheduledTimeouts(game);

	getIO().to(game.gameID).emit("round_end", {
		player1Score: statistics.player1.score,
		player2Score: statistics.player2.score,
		scoringPlayerID,
		reason,
	});

	if (gameHasEnded(game)) {
		processGameEnd(game);
	}
	else {
		const playerNames = getPlayerNames(game);
		scheduleForGame(game, NEXT_ROUND_DELAY_MILLI, () => {
			if (!(game.gameID in games)) return;
			startRoundSequence(game, {
				phase: "next_round",
				title: `${playerNames[scoringPlayerID]} scored!`,
				subtitle: "Next round starts soon",
			});
		});
	}
}

/**
 * Process a server tick, performing physics calculations and
 * sending back the updated position information to clients for rendering.
 * @param {Game} game
 */
function doTick(game){
	const cheatingScorer = processCheatInputs(game);
	if (cheatingScorer !== null) {
		awardPoint(game, cheatingScorer, "cheat");
		return;
	}

	runPhysicsCalculations(game.state);
	updatePositions(game.state.positions);
	sendPositionsToClients(game.gameID, game.state);
	getPlayerInputs(game.gameID);
	processRoundEnd(game);
}

/**
 * Ask clients to send back player inputs.
 * @param {string} gameID
 */
function getPlayerInputs(gameID){
	getIO().to(gameID).emit("collect_inputs");
}

/**
 * If the ball has hit the ground, award a point to the scoring player.
 * @param {Game} game
 */
function processRoundEnd(game){
	const positions = game.state.positions;
	if (!player1Scored(positions.ball) && !player2Scored(positions.ball)) return;

	if (player1Scored(positions.ball)) awardPoint(game, "player1", "regular");
	else if (player2Scored(positions.ball)) awardPoint(game, "player2", "regular");
}

/**
 * @param {Game} game
 */
function gameHasEnded(game){
	const statistics = game.state.statistics;
	return statistics.player1.score >= NUM_POINTS_TO_WIN || statistics.player2.score >= NUM_POINTS_TO_WIN;
}

/**
 * Once a player reaches the required number of points to win, end the game and send back player statistics.
 * @param {Game} game
 */
function processGameEnd(game){
	if (!gameHasEnded(game)) return;

	stopRound(game);
	clearScheduledTimeouts(game);

	for (const player of Object.values(game.players)) player.ready = false;

	const statistics = game.state.statistics;
	const playerNames = getPlayerNames(game);
	const winnerID = statistics.player1.score >= NUM_POINTS_TO_WIN ? "player1" : "player2";

	getIO().to(game.gameID).emit("match_finished", {
		winnerID,
		playerNames,
		statistics,
		message: `${playerNames[winnerID]} wins the match!`,
	});

	scheduleForGame(game, GAME_OVER_SEQUENCE_MILLI, () => {
		if (!(game.gameID in games)) return;
		getIO().to(game.gameID).emit("game_end", { statistics, playerNames });
	});
}

/**
 * Handles player disconnection / leaving the game room.
 * @param {import("socket.io").Socket} socket
 */
function leaveGame(socket){
	if (!(socket.id in players)) return;
	const gameID = players[socket.id].joinedGameID;
	const game = games[gameID];
	if (!game) {
		delete players[socket.id];
		return;
	}

	delete game.players[socket.id];
	delete players[socket.id];
	socket.leave(gameID);

	getIO().to(game.gameID).emit("opponent_disconnected");

	stopRound(game);
	clearScheduledTimeouts(game);

	if (Object.keys(game.players).length == 0){
		delete games[gameID];
	}
}

const eventHandlers = {
	gameLoaded(socket){
		handlePlayerReady(socket, false);
	},

	/**
	 * @param {import("socket.io").Socket} socket
	 * @param {Set<string>} inputs
	 */
	updatePlayerInputs(socket, inputs){
		const player = players[socket.id];
		if (!player) return;
		const playerID = player.playerID;
		const game = games[player.joinedGameID];
		if (!game) return;
		game.state.inputs[playerID] = inputs;
	},

	playerReadyToRestart(socket){
		handlePlayerReady(socket, true);
	},

	exitGamePage(socket){
		leaveGame(socket);
	},

	disconnect(socket){
		if (!(socket.id in players)) return;
		leaveGame(socket);
	}
};

module.exports = { createGame, eventHandlers };
