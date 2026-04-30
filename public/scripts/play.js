import { drawGameFrame } from "./renderer.js";

const game = (function () {
	const socket = io();

	// Prevent double-adding socket event listeners
	let hasEnteredRoomListingPageBefore = false;
	let hasEnteredGamePageBefore = false;

	function getPlayerName() {
		const boot = (() => {
			try {
				const raw = document.body?.dataset?.bootstrapUser || "";
				return raw ? JSON.parse(decodeURIComponent(raw)) : null;
			} catch {
				return null;
			}
		})();
		const fromBoot = boot?.name || boot?.username || "";
		const fromSessionStorage = sessionStorage.getItem("playerName") || "";
		return (fromBoot || fromSessionStorage).trim();
	}

	const initConnectPage = function () {
		$("#connect-message").text("");

		socket.on("connect_error", (error) => {
			$("#connect-message").text(error.message);
		});

		socket.on("connect", () => {
			const playerName = getPlayerName();
			$("#player-display-name").text(playerName);

			socket.emit("enter_room_listing_page", playerName);
		});

		socket.on("disconnect", () => {
			window.location.reload();
		});

		$("#back-home-button").on("click", async function () {
			// optional: keep session, just navigate home
			window.location.href = "/";
		});
	};

	const initRoomListingPage = function () {
		$("#room-message").text("");

		function setRoomButtons() {
			$("#create-room-button").off("click");
			$(".join-room-button").off("click");
			$(".leave-room-button").off("click");
			$(".ready-button").off("click");

			$("#create-room-button").on("click", function () {
				socket.emit("create_room");
			});

			$(".join-room-button").on("click", function (e) {
				socket.emit("join_room", $(e.currentTarget).attr("data-roomid"));
			});

			$(".leave-room-button").on("click", function (e) {
				socket.emit("leave_room", $(e.currentTarget).attr("data-roomid"));
			});

			$(".ready-button").on("click", function (e) {
				socket.emit("ready", $(e.currentTarget).attr("data-roomid"));
			});
		}

		if (!hasEnteredRoomListingPageBefore) {
			hasEnteredRoomListingPageBefore = true;

			socket.on("enter_room_listing_page_success", () => {
				$("#connect-page").hide();
				$("#game-page").hide();
				$("#room-listing-page").show();
			});

			socket.on("update_rooms", (rooms) => {
				$("#room-listing").empty();

				for (const room of Object.values(rooms)) {
					const roomElement = $($("#room-template").html());

					roomElement.attr("data-roomid", room.roomID);
					roomElement.find(".join-room-button").attr("data-roomid", room.roomID);
					roomElement.find(".leave-room-button").attr("data-roomid", room.roomID);
					roomElement.find(".ready-button").attr("data-roomid", room.roomID);

					const players = Object.values(room.players);
					if (players.at(0) !== undefined) {
						roomElement.find(".player1-name").text(players.at(0).name);
						if (players.at(0).ready) roomElement.find(".player1-name").addClass("ready");
					}
					if (players.at(1) !== undefined) {
						roomElement.find(".player2-name").text(players.at(1).name);
						if (players.at(1).ready) roomElement.find(".player2-name").addClass("ready");
					}

					$("#room-listing").append(roomElement);
				}

				setRoomButtons();
			});

			socket.on("room_page_success", (msg) => {
				$("#room-message").text(msg);
			});

			socket.on("room_page_error", (msg) => {
				$("#room-message").text(msg);
			});

			socket.on("enter_game_page", () => {
				$("#room-listing-page").hide();
				$("#game-page").show();
				initGamePage();
				socket.emit("game_loaded");
			});
		}
	};

	const initGamePage = function () {
		const playerInputs = new Set();
		let latestPlayerNames = { player1: "Player 1", player2: "Player 2" };

		function hideMessageAndButtons() {
			$("#game-message").text("");
			$("#game-buttons").hide();
			$("#game-over-panel").hide();
		}

		function updateScoreLabels() {
			$("#player1-name-label").text(latestPlayerNames.player1 || "Player 1");
			$("#player2-name-label").text(latestPlayerNames.player2 || "Player 2");
		}

		function renderGameOver({ statistics, playerNames }) {
			latestPlayerNames = {
				player1: playerNames?.player1 || "Player 1",
				player2: playerNames?.player2 || "Player 2",
			};
			updateScoreLabels();

			const rows = ["player1", "player2"].map((playerID) => ({
				playerID,
				name: playerNames?.[playerID] || playerID,
				score: statistics[playerID].score,
				jumps: statistics[playerID].numJumps,
				smacks: statistics[playerID].numSmacks,
			}));

			const ranking = [...rows].sort((a, b) => b.score - a.score);
			$("#ranking-list").empty();
			for (const player of ranking) {
				$("#ranking-list").append(`<li>${player.name} (${player.score} pts)</li>`);
			}

			$("#stats-table-body").empty();
			for (const player of ranking) {
				$("#stats-table-body").append(`
          <tr>
            <td>${player.name}</td>
            <td>${player.score}</td>
            <td>${player.jumps}</td>
            <td>${player.smacks}</td>
          </tr>
        `);
			}

			const me = getPlayerName();
			const meRow = rows.find((r) => r.name === me);
			const otherRow = rows.find((r) => r.name !== me);
			if (meRow && otherRow) {
				$("#game-over-title").text(meRow.score > otherRow.score ? "You Win!" : "You Lose!");
			} else {
				$("#game-over-title").text("Game Over");
			}

			$("#game-over-panel").show();
		}

		function setEventListeners() {
			function windowKeyDown(e) {
				playerInputs.add(e.key);
			}
			function windowKeyUp(e) {
				playerInputs.delete(e.key);
			}

			window.removeEventListener("keydown", windowKeyDown);
			window.removeEventListener("keyup", windowKeyUp);
			$("#restart-game-button").off("click");
			$("#return-to-lobby-button").off("click");

			window.addEventListener("keydown", windowKeyDown);
			window.addEventListener("keyup", windowKeyUp);

			$("#restart-game-button").on("click", function () {
				socket.emit("restart_ready");
				$("#game-message").text("Waiting for opponent to restart...");
			});

			$("#return-to-lobby-button").on("click", function () {
				const playerName = getPlayerName();
				socket.emit("return_to_room_listing", playerName);

				$("#game-page").hide();
				$("#room-listing-page").show();
				initRoomListingPage();
			});

			$("#back-home-from-game-button").on("click", function () {
				window.location.href = "/";
			});
		}

		if (!hasEnteredGamePageBefore) {
			hasEnteredGamePageBefore = true;

			socket.on("game_page_error", (msg) => {
				$("#game-message").text(msg);
			});

			socket.on("start_game", (payload) => {
				hideMessageAndButtons();
				setEventListeners();
				if (payload?.playerNames) {
					latestPlayerNames = {
						player1: payload.playerNames.player1 || "Player 1",
						player2: payload.playerNames.player2 || "Player 2",
					};
				}
				updateScoreLabels();
				$("#player1-score").text(0);
				$("#player2-score").text(0);
			});

			socket.on("collect_inputs", () => {
				socket.emit("send_inputs", [...playerInputs]);
			});

			socket.on("update_positions", (positions) => {
				drawGameFrame(positions);
			});

			socket.on("round_end", ({ player1Score, player2Score }) => {
				$("#player1-score").text(player1Score);
				$("#player2-score").text(player2Score);
			});

			socket.on("game_end", (payload) => {
				renderGameOver(payload);
				$("#game-message").text("");
				$("#game-buttons").show();
			});

			socket.on("opponent_disconnected", () => {
				$("#game-message").text("Opponent disconnected.");
				$("#game-buttons").show();
			});
		}
	};

	const init = function () {
		initConnectPage();
		initRoomListingPage();
	};

	return { init };
})();

game.init();

