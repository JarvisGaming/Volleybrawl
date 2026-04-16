const playerJoin = (socket, io, gameState, name) => {
	// 1. The player should not join the game when a game has already started
	if (gameState.gameStarted){
		socket.emit("join_error", "A game has started. Please try again later.");
		return;
	}

	// 2. The player should not join when there are already 2 players in the game
	if (Object.keys(gameState.players).length == 2){
		socket.emit("join_error", "The game is full already. Please try again later.");
		return;
	}

	// 3. The player should not join when another player in the game has used the same name
	for (const player of Object.values(gameState.players)){
		if (player.name == name){
			socket.emit("join_error", "The name has already been used in the game.");
			return;
		}
	}

	// Put the player in the players object
	gameState.players[socket.id] = { name, ready: false };
	socket.emit("join_success");
	io.to(gameState.roomID).emit("update_players", gameState.players);

	console.log("Current players -", gameState.players); // DON'T DELETE - FOR MARKING
};

const startGame = function(io, gameState) {
	io.emit("game_start");
	gameState.gameStarted = true;
};

// Wait for a player to get ready in the game
const playerReady = (socket, io, gameState) => {
	// Mark the player as ready
	gameState.players[socket.id]["ready"] = true;

	// Broadcast the players to the connected browsers
	io.to(gameState.roomID).emit("update_players", gameState.players);

	// Check if everybody is ready; if so, start the game automatically
	if (Object.values(gameState.players).every((player) => player.ready)){
		startGame(io, gameState);
	}

	console.log("Current players -", gameState.players); // DON'T DELETE - FOR MARKING
};

const finishGame = function(io, gameState) {
	// Tell the browsers the game has finished
	io.to(gameState.roomID).emit("game_end", gameState.players);

	// Reset the game
	gameState.players = {};
	gameState.gameStarted = false;
};

// Set up the choose event
const chooseSign = (socket, io, gameState, sign) => {
	// Assign the sign to the player
	gameState.players[socket.id]["sign"] = sign;

	// Check if everybody has selected a hand sign, if so, the game will finish
	if (Object.values(gameState.players).every((player) => player.sign != undefined)){
		finishGame(io, gameState);
	}

	console.log("Current players -", gameState.players); // DON'T DELETE - FOR MARKING
};

const playerDisconnect = (socket, io, gameState) => {
	// Remove the player from the game
	if (gameState.players[socket.id]) {
		delete gameState.players[socket.id];

		// Broadcast the players to the connected browsers
		io.to(gameState.roomID).emit("update_players", gameState.players);
	}
};

module.exports = { playerJoin, playerReady, chooseSign, playerDisconnect };