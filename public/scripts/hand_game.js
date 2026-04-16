const HandGame = (function() {
	const socket = io();

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
				socket.emit("join_room", $(e.currentTarget).attr("data-roomid"));
			});

			$(".leave-room-button").on("click", function(e) {
				socket.emit("leave_room", $(e.currentTarget).attr("data-roomid"));
			});
	
			$(".ready-button").on("click", function(e) {
				socket.emit("ready", $(e.currentTarget).attr("data-roomid"));
			});
		}

		socket.on("update_rooms", (rooms) => {
			// Empty out listing
			$("#room-listing").empty();

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

		socket.on("room_page_success", (msg) => {
			$("#room-message").text(msg);
		});

		socket.on("room_page_error", (msg) => {
			$("#room-message").text(msg);
		});
	};

	const init = function() {
		// Initialize connect page related events
		initConnectPage();
	};

	return { init };
})();

HandGame.init();