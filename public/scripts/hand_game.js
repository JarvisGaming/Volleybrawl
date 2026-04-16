const HandGame = (function() {
	const socket = io();
	// let inGame = false;
	
	const initConnectPage = function() {
		// Show the connection error to Socket.IO
		socket.on("connect_error", (error) => {
			$("#connect-message").text(error.message);
		});

		// Wait for the socket to connect successfully
		socket.on("connect", () => {
			// Show the join page
			$("#hand-game-connect-page").hide();
			$("#hand-game-join-page").show();

			// Initialize join page related events
			initJoinPage();
		});

		// Go back to front page if disconnected
		socket.on("disconnect", () => {
			// Reload the page
			window.location.reload();
		});
	};

	const initJoinPage = function() {
		$("#join-button").on("click", function(e) {
			// Do not submit the form
			e.preventDefault();

			// Prepare the player name
			let playerName = $("#join-name").val().trim();
			if (playerName == "") {
				$("#join-message").text("Your name is empty.");
				return;
			}
			
			// Send the WebSocket message to the server
			socket.emit("join", playerName);
		});

		// Handle the error for the join request
		socket.on("join_error", (error) => {
			// Show the error
			$("#join-message").text(error);
		});

		// The player joins the game successfully
		socket.on("join_success", () => {
			// Show the main page if successfully joined
			$("#hand-game-join-page").hide();
			$("#hand-game-main-page").show();

			// Initialize main page related events
			initRoomPage();
			// inGame = true;
		});
	};

	const initRoomPage = function() {
		function setRoomButtons(){
			$(".join-room-button").on("click", function(e) {
				// Do not submit the form
				e.preventDefault();
	
				// Send the WebSocket message to the server
				console.log($(e.currentTarget).attr("data-roomid"));
				socket.emit("join_room", $(e.currentTarget).attr("data-roomid"));
			});
	
			$(".ready-button").on("click", function(e) {
				// Do not submit the form
				e.preventDefault();
	
				// Send the WebSocket message to the server
				socket.emit("ready", $(e.currentTarget).attr("data-roomid"));
	
			});
		}

		socket.on("join_room_success", (msg) => {
			$("#room-message").text(msg);
		});

		socket.on("join_room_error", (msg) => {
			$("#room-message").text(msg);
		});

		socket.on("ready_error", (msg) => {
			$("#room-message").text(msg);
		});


		socket.on("update_rooms", (rooms) => {
			// Empty out listing
			$("#room-listing").empty();

			// Loop through all rooms, clone template node, add back room info, and append to listing
			for (const room of Object.values(rooms)) {
				const roomElement = $($("#room-template").html());
				console.log(roomElement);

				roomElement.attr("data-roomid", room.roomID);
				roomElement.find(".join-room-button").attr("data-roomid", room.roomID);
				roomElement.find(".ready-button").attr("data-roomid", room.roomID);

				const playerNames = Object.values(room.players).map((player) => player.name);
				console.log(playerNames);
				if (playerNames.at(0) != undefined) roomElement.find(".player1-name").text(playerNames.at(0));
				if (playerNames.at(1) != undefined) roomElement.find(".player2-name").text(playerNames.at(1));

				$("#room-listing").append(roomElement);
			}

			setRoomButtons();
		});

		setRoomButtons();
	};

	// const updatePlayers = function(players) {
	// 	$(".player").hide();

	// 	// Put the players in each box
	// 	let index = 1;
	// 	for (const id in players) {
	// 		const player = players[id];

	// 		// Show the correct status
	// 		let name = "You are";
	// 		if (id != socket.id)
	// 			name = `${player["name"]} is`;
	// 		let status;
	// 		if (player["sign"])
	// 			status = `${name} ${player["sign"]}!`;
	// 		else if (player["ready"])
	// 			status = `${name} ready!`;
	// 		else
	// 			status = `${name} not yet ready!`;
	// 		$("#player" + index).find(".status").text(status);

	// 		// Update the sign image
	// 		if (player["sign"])
	// 			$("#player" + index).find("img").attr("src", `images/${player["sign"]}.png`);
	// 		else
	// 			$("#player" + index).find("img").attr("src", `images/unknown_signs.png`);

	// 		$("#player" + index).show();

	// 		index++;
	// 	}
	// };

	// const initMainPage = function() {
	// 	// Update the players in the game
	// 	socket.on("update_players", (players) => {
	// 		if (!inGame) return;

	// 		updatePlayers(players);
	// 	});

	// 	$("#ready-button").on("click", function() {
	// 		// Send the WebSocket message to the server
	// 		socket.emit("ready");

	// 		// Hide the ready button
	// 		$("#ready-button").hide();
	// 		$("#game-message").text("Please wait for other players...");
	// 	});

	// 	// Wait for the game to start
	// 	socket.on("game_start", () => {
	// 		if (!inGame) return;

	// 		// Show the sign buttons
	// 		$("#sign-buttons").show();
	// 	});

	// 	$(".sign-button").on("click", function(e) {
	// 		// Get the sign
	// 		const sign = $(e.currentTarget).attr("data-sign");
			
	// 		// Send the WebSocket message to the server
	// 		socket.emit("choose", sign);

	// 		// Hide the sign button
	// 		$("#sign-buttons").hide();
	// 		$("#game-message").text("Please wait for other players...");
	// 	});

	// 	// Wait for the game to finish
	// 	socket.on("game_end", (players) => {
	// 		if (!inGame) return;

	// 		updatePlayers(players);

	// 		// Check whether you win the game
	// 		const signs = [0, 0, 0];
	// 		let yourSign;

	// 		for (const id in players) {
	// 			switch (players[id]["sign"]) {
	// 				case "rock":
	// 					signs[0]++;
	// 					if (id == socket.id) yourSign = 0;
	// 					break;
	// 				case "paper":
	// 					signs[1]++;
	// 					if (id == socket.id) yourSign = 1;
	// 					break;
	// 				case "scissors":
	// 					signs[2]++;
	// 					if (id == socket.id) yourSign = 2;
	// 					break;
	// 			}
	// 		}

	// 		let result = "You draw!";
	// 		if (signs[(yourSign + 2) % 3] > 0 && signs[(yourSign + 1) % 3] == 0)
	// 			result = "You win!";
	// 		if (signs[(yourSign + 2) % 3] == 0 && signs[(yourSign + 1) % 3] > 0)
	// 			result = "You lose!";

	// 		$("#game-message").text(result);
	// 		inGame = false;

	// 		$("#restart-button").show();
	// 	});

	// 	$("#restart-button").on("click", function() {
	// 		// Reload the page
	// 		window.location.reload();
	// 	});
	// };

	const init = function() {
		// Initialize connect page related events
		initConnectPage();
	};

	return { init };
})();

HandGame.init();