/**
 * @file Shared variables and functions across server files.
 */

/**
 * Socket.IO server instance.
 * @type {import("socket.io").Server}
 */
let io = null;

/**
 * Initialize shared instances.
 * @param {import("socket.io").Server} ioInstance 
 */
function initialize(ioInstance) {
	io = ioInstance;
};

/**
 * Get the Socket.IO server instance.
 * @returns {import("socket.io").Server}
 */
const getIO = function() {
	return io;
};

/**
 * Clamps a given number between two bounds.
 * @param {Number} number 
 * @param {Number} lowerBound 
 * @param {Number} upperBound 
 * @returns {Number}
 */
function clamp(number, lowerBound, upperBound){
	return Math.min(Math.max(number, lowerBound), upperBound);
}

/**
 * Check if all players in a room / game are ready.
 * @property {Object.<string, any>} playersObject
 */
function allPlayersAreReady(playersObject){
	return Object.keys(playersObject).length == 2 && Object.values(playersObject).every(player => player.ready);
}

const TARGET_FPS = 60;

const GAMEFIELD_WIDTH = 800;
const GAMEFIELD_HEIGHT = 600;

const PLAYER_RADIUS = 50;
const SMACK_RADIUS = 110;
const BALL_RADIUS = 25;
const NET_WIDTH = 15;

const SMACK_COOLDOWN_MILLI = 500; 
const NUM_POINTS_TO_WIN = 5;

module.exports = { initialize, getIO, clamp, allPlayersAreReady, TARGET_FPS, GAMEFIELD_WIDTH, GAMEFIELD_HEIGHT, PLAYER_RADIUS, SMACK_RADIUS, BALL_RADIUS, NET_WIDTH, SMACK_COOLDOWN_MILLI, NUM_POINTS_TO_WIN };