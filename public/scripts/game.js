const game = (function() {
	const socket = io();

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

		// Server currently doesn't throw "enter_room_listing_page_error"
		// socket.on("enter_room_listing_page_error", (error) => {
		// 	$("#join-message").text(error);
		// });

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
		// Not included in setRoomButtons() since it is not dynamically generated, so we don't need to re-attach event handlers to it
		$("#create-room-button").on("click", function() {
			socket.emit("create_room");
		});
		
		/**
		 * Attach event handlers to the buttons of each room.
		 * This is called every time the room listing is updated, since rooms are dynamically generated.
		 */
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

		socket.on("load_game", () => {
			// Show the game page
			$("#room-listing-page").hide();
			$("#game-page").show();
			initGamePage();
			socket.emit("game_loaded");
		});
	};

	const initGamePage = function() {
		// Store position information sent from server
		let positions = null;

		// Listen to player inputs
		const queuedInputs = new Set();
		window.addEventListener("keydown", (e) => queuedInputs.add(e.key));

		// Displays messages for failed operations in the game page.
		socket.on("game_page_error", (msg) => {
			$("#game-message").text(msg);
		});

		socket.on("start_game", () => {
			// For now we just display a message, but you can replace this with actual game logic
			$("#game-message").text("The game has started!");
		});

		// Send inputs to the server
		socket.on("collect_inputs", () => {
			socket.emit("send_inputs", queuedInputs);
			queuedInputs.clear();
		});

		// Every server tick, clients receive updated position information
		socket.on("update_positions", (updatedPositions) => {
			positions = updatedPositions;
			console.log(positions);
			drawGameFrame();
		});

		// Every client frame, clients rerender the canvas based on the stored positions
		function drawGameFrame(){
			/**
			 * @type {CanvasRenderingContext2D}
			 */
			const context = $("#game-canvas").get(0).getContext("2d");
			context.clearRect(0, 0, context.canvas.width, context.canvas.width);
			
			class Sprite {
				constructor(x, y){
					this.x = x;
					this.y = y;
				}
			}

			class Circle extends Sprite {
				constructor(x, y, radius, color){
					super(x, y);
					this.radius = radius;
					this.color = color;
				}
				draw(){
					context.beginPath();
					context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
					context.fillStyle = this.color;
					context.fill();
				}
			}

			class Net extends Sprite {
				constructor(x, y){
					super(x, y);
				}
				draw(){
					context.beginPath();
					context.rect(this.x, this.y, 20, 300);
					context.fillStyle = "black";
					context.fill();
				}
			}

			// Players
			const player1 = new Circle(positions.player1.x, positions.player1.y, 50, "red");
			player1.draw();

			const player2 = new Circle(positions.player2.x, positions.player2.y, 50, "blue");
			player2.draw();

			// Ball
			const ball = new Circle(positions.ball.x, positions.ball.y, 25, "green");
			ball.draw();

			// Net
			const net = new Net(positions.net.x, positions.net.y);
			net.draw();
		};
	};

	const init = function() {
		// Initialize connect page related events
		initConnectPage();
	};

	return { init };
})();

game.init();