import {drawGameFrame} from "./renderer.js";

const game = (function() {
	const socket = io();

	// These exist to prevent double adding of socket event listeners (socket.on(...))'
	// This problem only exists for pages that you can exit and re-enter multiple times
	let hasEnteredRoomListingBefore = false;
	let hasEnteredGameBefore = false;

	const initConnectPage = function() {
		// Show the connection error to Socket.IO
		socket.on("connect_error", (error) => {
			$("#connect-message").text(error.message);
		});

		// Wait for the socket to connect successfully
		socket.on("connect", () => {
			// Show the join page
			$("#connect-page").hide();
			$("#join-page").show();

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
			socket.emit("enter_room_listing_page", playerName);
		});

		// The player joins the game successfully
		socket.on("enter_room_listing_page_success", () => {
			// Show the main page if successfully joined
			$("#join-page").hide();
			$("#room-listing-page").show();

			// Initialize main page related events
			initRoomListingPage();
		});
	};

	const initRoomListingPage = function() {
		$("#room-message").text("");

		/**
		 * Attach event handlers to the buttons of each room, as well as the create room button.
		 * This is called every time the room listing is updated, since rooms are dynamically generated.
		 * To prevent adding the listeners multiple times (e.g. the user returns to this menu after a game),
		 * we remove the event listeners first.
		 */
		function setRoomButtons(){
			// Remove already existing event listeners (if any)
			$("#create-room-button").off("click");
			$(".join-room-button").off("click");
			$(".leave-room-button").off("click");
			$(".ready-button").off("click");

			$("#create-room-button").on("click", function() {
				socket.emit("create_room");
			});

			$(".join-room-button").on("click", function(e) {
				socket.emit("join_room", $(e.currentTarget).attr("data-roomid"));
			});

			$(".leave-room-button").on("click", function(e) {
				socket.emit("leave_room", $(e.currentTarget).attr("data-roomid"));
			});
	
			$(".ready-button").on("click", function(e) {
				socket.emit("ready", $(e.currentTarget).attr("data-roomid"));
			});
		}

		// Only add socket event listeners if they haven't been added yet
		if (!hasEnteredRoomListingBefore){
			hasEnteredRoomListingBefore = true;

			// Update the room listing with the latest information from the server
			socket.on("update_rooms", (rooms) => {
				// Empty out listing
				$("#room-listing").empty();

				// Re-populate room listing with up-to-date information
				for (const room of Object.values(rooms)) {
					// Clone template element
					const roomElement = $($("#room-template").html());

					// Add back roomID information
					roomElement.attr("data-roomid", room.roomID);
					roomElement.find(".join-room-button").attr("data-roomid", room.roomID);
					roomElement.find(".leave-room-button").attr("data-roomid", room.roomID);
					roomElement.find(".ready-button").attr("data-roomid", room.roomID);

					// Set player names and their ready statues
					const players = Object.values(room.players);

					if (players.at(0) != undefined) {
						roomElement.find(".player1-name").text(players.at(0).name);
						if (players.at(0).ready) roomElement.find(".player1-name").addClass("ready");
					}
					if (players.at(1) != undefined) {
						roomElement.find(".player2-name").text(players.at(1).name);
						if (players.at(1).ready) roomElement.find(".player2-name").addClass("ready");
					}

					$("#room-listing").append(roomElement);
				}

				// Re-attach event handlers to the new buttons
				setRoomButtons();
			});

			// Displays messages for successful operations in the room listing page.
			socket.on("room_page_success", (msg) => {
				$("#room-message").text(msg);
			});

			// Displays messages for failed operations in the room listing page.
			socket.on("room_page_error", (msg) => {
				$("#room-message").text(msg);
			});

			// Show the game page
			socket.on("enter_game_page", () => {
				$("#room-listing-page").hide();
				$("#game-page").show();
				initGamePage();
				socket.emit("game_loaded");
			});
		}
	};

	const initGamePage = function() {
		// Store position information sent from server
		let positions = null;

		// Listen to player inputs
		const playerInputs = new Set();

		function hideMessageAndButtons(){
			$("#game-message").text("");
			$("#game-buttons").hide();
		};

		function setEventListeners(){
			function windowKeyDown(e){ playerInputs.add(e.key); }
			function windowKeyUp(e){ playerInputs.delete(e.key); }

			// Remove existing listeners to prevent adding multiple
			window.removeEventListener("keydown", windowKeyDown);
			window.removeEventListener("keyup", windowKeyUp);
			$("#restart-game-button").off("click");
			$("#return-to-lobby-button").off("click");

			// Add event listeners
			window.addEventListener("keydown", windowKeyDown);
			window.addEventListener("keyup", windowKeyUp);
	
			$("#restart-game-button").on("click", function() {
				socket.emit("restart_ready");
				$("#game-message").text("Waiting for opponent to restart...");
			});
			
			$("#return-to-lobby-button").on("click", function() {
				// This should be modified to grab the username from e.g. sessionStorage instead
				let playerName = $("#join-name").val().trim();
				socket.emit("return_to_room_listing", playerName);

				$("#game-page").hide();
				$("#room-listing-page").show();
				initRoomListingPage();
			});
		}

		// Only add socket event listeners if they haven't been added yet
		if (!hasEnteredGameBefore){
			hasEnteredGameBefore = true;

			// Displays messages for failed operations in the game page.
			socket.on("game_page_error", (msg) => {
				$("#game-message").text(msg);
			});

			socket.on("start_game", () => {
				hideMessageAndButtons();
				setEventListeners();
				$("#player1-score").text(0);
				$("#player2-score").text(0);
			});

			// Send inputs to the server
			socket.on("collect_inputs", () => {
				// Set<string> is not serializable, need to convert to array first before casting it back on the server side
				socket.emit("send_inputs", [...playerInputs]);
			});

			// Every server tick, clients receive updated position information
			socket.on("update_positions", (updatedPositions) => {
				positions = updatedPositions;

				// Clients rerender the canvas based on the stored positions
				drawGameFrame(positions);
			});

			// Some player scored
			socket.on("round_end", ({player1Score, player2Score}) => {
				$("#player1-score").text(player1Score);
				$("#player2-score").text(player2Score);
			});

			socket.on("game_end", (statistics) => {
				$("#game-message").text(JSON.stringify(statistics));
				$("#game-buttons").show();
			});

			socket.on("opponent_disconnected", () => {
				$("#game-message").text("Opponent disconnected.");
				$("#game-buttons").show();
			});
		}
	};

	const init = function() {
		// Initialize connect page related events
		initConnectPage();
	};

	return { init };
})();

game.init();