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

const targetFPS = 60;
const playerRadius = 50;
const ballRadius = 25;
const gamefieldWidth = 800;
const gamefieldHeight = 600;

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

module.exports = { initialize, getIO, targetFPS, clamp, playerRadius, ballRadius, gamefieldWidth, gamefieldHeight };