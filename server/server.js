/**
 * Run with node server/server.js at root directory
 */

const { initialize } = require("./shared.js");

const roomController = require("./controllers/room_controller.js").eventHandlers;
const gameController = require("./controllers/game_controller.js").eventHandlers;
const authController = require("./controllers/auth_controller.js");
const path = require("path");

// Create the Express app
const express = require("express");
const app = express();

// EJS views (server-rendered pages)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Parse JSON bodies (auth endpoints)
app.use(express.json());

// Sessions (shared with Socket.IO)
const session = require("express-session");
const gameSession = session({
	secret: "game",
	resave: false,
	saveUninitialized: false,
	rolling: true,
	cookie: { maxAge: 300000 },
});
app.use(gameSession);

// Auth endpoints
app.post("/register", authController.register);
app.post("/signin", authController.signin);
app.get("/validate", authController.validate);
app.get("/signout", authController.signout);

// Pages
app.get("/", (req, res) => {
	res.render("home_auth_view", { user: req.session.user ?? null });
});

app.get("/play", (req, res) => {
	if (!req.session.user) {
		res.redirect("/");
		return;
	}
	res.render("play_view", { user: req.session.user });
});

// Use the 'public' folder to serve static files
// Keep this AFTER page routes so "/" never serves public/index.html.
app.use(express.static("public", { index: false }));

// Create the Socket.IO server
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer);

// Initialize the shared io instance, so we don't have to pass it explictly into controller functions
initialize(io);

// Share Express session with Socket.IO
io.use((socket, next) => {
	gameSession(socket.request, {}, next);
});

// Handle the web socket connection
io.on("connection", (socket) => {
	// Room controller
	socket.on("enter_room_listing_page", (playerName) => roomController.enterRoomListingPage(socket, playerName));
	socket.on("create_room", () => roomController.createRoom(socket));
	socket.on("join_room", (roomID) => roomController.joinRoom(socket, roomID));
	socket.on("leave_room", (roomID) => roomController.leaveRoom(socket, roomID));
	socket.on("ready", (roomID) => roomController.readyUp(socket, roomID));

	// Game controller
	socket.on("game_loaded", () => gameController.gameLoaded(socket));
	socket.on("send_inputs", (inputsArray) => gameController.updatePlayerInputs(socket, new Set(inputsArray)));
	socket.on("restart_ready", () => gameController.playerReadyToRestart(socket));

	// roomController doesn't call gameController directly, to prevent circular dependency
	socket.on("return_to_room_listing", (playerName) => {
		gameController.exitGamePage(socket);
		roomController.enterRoomListingPage(socket, playerName);
	});

	// Handle disconnect across controllers (each one will check whether the player is in their player list and do the necessary clean up if so)
	socket.on("disconnect", () => {
		roomController.disconnect(socket);
		gameController.disconnect(socket);
	});
});

// Use a web server to listen at port 8000
// Note that httpServer is used for a WebSocket server
httpServer.listen(8000, () => {
	console.log("The game server has started...");
});
