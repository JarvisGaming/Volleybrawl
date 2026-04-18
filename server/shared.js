/**
 * Shared variables and functions across server files.
 */

let io = null;

/**
 * Initialize shared instances.
 * @param {import("socket.io").Server} ioInstance 
 */
const initialize = function(ioInstance) {
	io = ioInstance;
};

/**
 * Get the Socket.IO server instance.
 * @returns {import("socket.io").Server}
 */
const getIO = function() {
	return io;
};

module.exports = { initialize, getIO };