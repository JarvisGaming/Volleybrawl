import { drawGameFrame } from "./renderer.js";

const game = (function () {
	const socket = io();
	let isNavigatingAway = false;

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

	function goHome(event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		isNavigatingAway = true;
		window.location.assign("/");
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
			if (isNavigatingAway) return;
			window.location.reload();
		});

		$("#back-home-button").on("click", function (event) {
			goHome(event);
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

					const roomPlayers = Object.values(room.players);
					if (roomPlayers.at(0) !== undefined) {
						roomElement.find(".player1-name").text(roomPlayers.at(0).name);
						if (roomPlayers.at(0).ready) roomElement.find(".player1-name").addClass("ready");
					}
					if (roomPlayers.at(1) !== undefined) {
						roomElement.find(".player2-name").text(roomPlayers.at(1).name);
						if (roomPlayers.at(1).ready) roomElement.find(".player2-name").addClass("ready");
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
		let localPlayerID = null;
		let keyDownHandler = null;
		let keyUpHandler = null;
		let audioUnlocked = false;
		let latestRenderState = null;
		let renderAnimationFrameID = null;
		let overlayTimeoutIDs = [];
		let bgmResumeTimeoutID = null;

		const soundIDs = {
			bgm: "bgm-audio",
			smack: "smack-audio",
			hit: "hit-audio",
			point: "point-audio",
			cheat: "cheat-audio",
			gameOver: "game-over-audio",
			countdown: "countdown-audio",
			go: "go-audio",
		};

		function getAudio(name) {
			return document.getElementById(soundIDs[name]);
		}

		function playSound(name, volume = 0.8) {
			const audio = getAudio(name);
			if (!audio) return;
			audio.volume = volume;
			audio.pause();
			audio.currentTime = 0;
			const promise = audio.play();
			if (promise) promise.catch(() => {});
		}

		function startBgm() {
			const bgm = getAudio("bgm");
			if (!bgm) return;
			bgm.volume = 0.32;
			bgm.loop = true;
			if (!bgm.paused) return;
			const promise = bgm.play();
			if (promise) promise.catch(() => {});
		}

		function stopBgm() {
			const bgm = getAudio("bgm");
			if (!bgm) return;
			bgm.pause();
			bgm.currentTime = 0;
		}

		function unlockAudio() {
			if (audioUnlocked) return;
			audioUnlocked = true;
			startBgm();
		}

		function clearOverlayTimers() {
			for (const id of overlayTimeoutIDs) window.clearTimeout(id);
			overlayTimeoutIDs = [];
			if (bgmResumeTimeoutID !== null) {
				window.clearTimeout(bgmResumeTimeoutID);
				bgmResumeTimeoutID = null;
			}
		}

		function hideRoundOverlay() {
			clearOverlayTimers();
			$("#round-overlay").hide();
		}

		function animateOverlayCount(text, isGo = false) {
			const countElement = $("#round-overlay-count");
			countElement.text(text);
			countElement.toggleClass("round-overlay-go", isGo);
			const rawElement = countElement.get(0);
			if (rawElement) {
				rawElement.style.animation = "none";
				void rawElement.offsetWidth;
				rawElement.style.animation = "";
			}
		}

		function showCountdownOverlay({ title, subtitle, countdownValues = ["3", "2", "1", "GO!"], stepDurationMilli = 750 }) {
			clearOverlayTimers();
			stopBgm();
			$("#round-overlay-title").text(title || "Get Ready!");
			$("#round-overlay-subtitle").text(subtitle || "Match starts soon");
			$("#round-overlay").show();

			countdownValues.forEach((value, index) => {
				overlayTimeoutIDs.push(window.setTimeout(() => {
					const isGo = String(value).toUpperCase() === "GO!";
					animateOverlayCount(value, isGo);
					playSound(isGo ? "go" : "countdown", isGo ? 0.36 : 0.28);
				}, index * stepDurationMilli));
			});

			bgmResumeTimeoutID = window.setTimeout(() => {
				bgmResumeTimeoutID = null;
				if (audioUnlocked) startBgm();
			}, countdownValues.length * stepDurationMilli + 140);

			overlayTimeoutIDs.push(window.setTimeout(() => {
				$("#round-overlay").hide();
			}, countdownValues.length * stepDurationMilli + 120));
		}

		function showAnnouncementOverlay({ title, mainText, subtitle, durationMilli = 1800, goStyle = false }) {
			clearOverlayTimers();
			stopBgm();
			$("#round-overlay-title").text(title || "Announcement");
			$("#round-overlay-subtitle").text(subtitle || "");
			animateOverlayCount(mainText || "!", goStyle);
			$("#round-overlay").show();
			overlayTimeoutIDs.push(window.setTimeout(() => {
				$("#round-overlay").hide();
			}, durationMilli));
		}

		function hideMessageAndButtons() {
			$("#game-message").text("");
			$("#game-buttons").hide();
			$("#game-over-panel").hide();
			hideRoundOverlay();
		}

		function updateScoreLabels() {
			$("#player1-name-label").text(latestPlayerNames.player1 || "Player 1");
			$("#player2-name-label").text(latestPlayerNames.player2 || "Player 2");
		}

		function inferLocalPlayerID() {
			if (localPlayerID) return localPlayerID;
			const me = getPlayerName();
			if (latestPlayerNames.player1 === me) localPlayerID = "player1";
			else if (latestPlayerNames.player2 === me) localPlayerID = "player2";
			return localPlayerID;
		}

		function updateCheatHud(renderState) {
			const playerID = inferLocalPlayerID();
			const enabled = playerID ? (renderState?.meta?.cheatMode?.[playerID] ?? renderState?.[playerID]?.cheatMode ?? false) : false;
			$("#cheat-panel").toggleClass("cheat-on", enabled).toggleClass("cheat-off", !enabled);
			$("#cheat-status").text(`Cheat mode: ${enabled ? "ON" : "OFF"}`);
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

		function startRenderLoop() {
			if (renderAnimationFrameID !== null) return;
			const render = () => {
				renderAnimationFrameID = window.requestAnimationFrame(render);
				if (latestRenderState) drawGameFrame(latestRenderState);
			};
			render();
		}

		function stopRenderLoop() {
			if (renderAnimationFrameID !== null) {
				window.cancelAnimationFrame(renderAnimationFrameID);
				renderAnimationFrameID = null;
			}
		}

		function removeGameKeyListeners() {
			if (keyDownHandler) window.removeEventListener("keydown", keyDownHandler);
			if (keyUpHandler) window.removeEventListener("keyup", keyUpHandler);
			keyDownHandler = null;
			keyUpHandler = null;
		}

		function shouldCaptureKey(key) {
			return ["ArrowLeft", "ArrowRight", "ArrowUp", " ", "f", "F", "p", "P"].includes(key);
		}

		function setEventListeners() {
			removeGameKeyListeners();
			$("#restart-game-button").off("click");
			$("#return-to-lobby-button").off("click");
			$("#back-home-from-game-button").off("click");
			$(document).off("pointerdown.gameaudio keydown.gameaudio");
			$(document).one("pointerdown.gameaudio keydown.gameaudio", unlockAudio);

			keyDownHandler = function (e) {
				if (shouldCaptureKey(e.key)) e.preventDefault();
				playerInputs.add(e.key);
				if (shouldCaptureKey(e.key)) unlockAudio();
			};
			keyUpHandler = function (e) {
				if (shouldCaptureKey(e.key)) e.preventDefault();
				playerInputs.delete(e.key);
			};

			window.addEventListener("keydown", keyDownHandler);
			window.addEventListener("keyup", keyUpHandler);

			$("#restart-game-button").on("click", function () {
				unlockAudio();
				socket.emit("restart_ready");
				$("#game-message").text("Waiting for opponent to restart...");
				$("#game-buttons").hide();
			});

			$("#return-to-lobby-button").on("click", function () {
				stopBgm();
				removeGameKeyListeners();
				stopRenderLoop();
				hideRoundOverlay();
				const playerName = getPlayerName();
				socket.emit("return_to_room_listing", playerName);

				$("#game-page").hide();
				$("#room-listing-page").show();
				initRoomListingPage();
			});

			$("#back-home-from-game-button").on("click", function (event) {
				stopBgm();
				removeGameKeyListeners();
				stopRenderLoop();
				hideRoundOverlay();
				goHome(event);
			});
		}

		function handleSoundEvents(events) {
			if (!Array.isArray(events)) return;
			for (const event of events) {
				if (event.type === "smack") playSound("smack", 0.72);
				else if (event.type === "hit") playSound("hit", 0.48);
				else if (event.type === "cheat_on" || event.type === "cheat_off") playSound("cheat", 0.62);
			}
		}

		if (!hasEnteredGamePageBefore) {
			hasEnteredGamePageBefore = true;
			startRenderLoop();

			socket.on("game_identity", ({ playerID }) => {
				localPlayerID = playerID;
				updateCheatHud(null);
			});

			socket.on("game_page_error", (msg) => {
				$("#game-message").text(msg);
			});

			socket.on("start_game", (payload) => {
				hideMessageAndButtons();
				setEventListeners();
				startRenderLoop();
				playerInputs.clear();
				if (payload?.playerNames) {
					latestPlayerNames = {
						player1: payload.playerNames.player1 || "Player 1",
						player2: payload.playerNames.player2 || "Player 2",
					};
				}
				inferLocalPlayerID();
				updateScoreLabels();
				updateCheatHud(null);
				$("#player1-score").text(0);
				$("#player2-score").text(0);
			});

			socket.on("collect_inputs", () => {
				socket.emit("send_inputs", [...playerInputs]);
			});

			socket.on("update_positions", (positions) => {
				handleSoundEvents(positions.soundEvents);
				updateCheatHud(positions);
				latestRenderState = positions;
			});

			socket.on("round_prepare", (payload) => {
				if (typeof payload?.player1Score === "number") $("#player1-score").text(payload.player1Score);
				if (typeof payload?.player2Score === "number") $("#player2-score").text(payload.player2Score);
				$("#game-message").text("");
				showCountdownOverlay(payload || {});
			});

			socket.on("round_end", ({ player1Score, player2Score, scoringPlayerID, reason }) => {
				$("#player1-score").text(player1Score);
				$("#player2-score").text(player2Score);
				playSound("point", 0.7);

				const scorerName = latestPlayerNames?.[scoringPlayerID] || scoringPlayerID;
				if (reason === "cheat") {
					$("#game-message").text(`${scorerName} used cheat mode for +1 point!`);
				}
				else {
					$("#game-message").text(`${scorerName} scored!`);
				}
				window.setTimeout(() => {
					if (!$("#round-overlay").is(":visible")) $("#game-message").text("");
				}, 1200);
			});

			socket.on("match_finished", (payload) => {
				removeGameKeyListeners();
				stopBgm();
				playSound("gameOver", 0.72);
				const myPlayerID = inferLocalPlayerID();
				const localWon = myPlayerID && payload?.winnerID === myPlayerID;
				showAnnouncementOverlay({
					title: "Game Over!",
					mainText: localWon ? "VICTORY!" : "DEFEAT",
					subtitle: payload?.message || "Match finished",
					durationMilli: 1900,
					goStyle: localWon,
				});
				$("#game-message").text("");
			});

			socket.on("game_end", (payload) => {
				renderGameOver(payload);
				$("#game-message").text("");
				$("#game-buttons").show();
			});

			socket.on("opponent_disconnected", () => {
				removeGameKeyListeners();
				stopBgm();
				hideRoundOverlay();
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
