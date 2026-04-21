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

const targetFPS = 60;

const gamefieldWidth = 800;
const gamefieldHeight = 600;

const playerRadius = 50;
const smackRadius = 110;
const ballRadius = 25;
const netWidth = 15;

const smackCooldownMilli = 500; 

module.exports = { initialize, getIO, clamp, targetFPS, gamefieldWidth, gamefieldHeight, playerRadius, smackRadius, ballRadius, netWidth, smackCooldownMilli };