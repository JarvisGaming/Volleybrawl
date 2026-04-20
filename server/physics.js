const { playerRadius, ballRadius, netWidth, gamefieldWidth, gamefieldHeight } = require("./shared.js");

function isGrounded(position, radius){ return position.y + radius >= gamefieldHeight; }
	
function isMovingLeft(inputSet){ return inputSet.has("ArrowLeft"); }
function isMovingRight(inputSet){ return inputSet.has("ArrowRight"); }
function isJumping(inputSet){ return inputSet.has("ArrowUp"); }
function isSmacking(inputSet){ return inputSet.has(" "); }

function ballIsInSideWall(ballPosition){ return ballPosition.x - ballRadius <= 0 || ballPosition.x + ballRadius >= gamefieldWidth; }
function ballIsInCeiling(ballPosition){ return ballPosition.y <= ballRadius; }
function ballIsUnderTopOfNet(ballPosition, netPosition) { return ballPosition.y >= netPosition.y; }
function ballIsCloseToLeftSideOfNet(ballPosition, netPosition) { return Math.abs(ballPosition.x - (netPosition.x - netWidth / 2)) <= ballRadius; }
function ballIsCloseToRightSideOfNet(ballPosition, netPosition) { return Math.abs(ballPosition.x - (netPosition.x + netWidth / 2)) <= ballRadius; }

function ballIsInNet(ballPosition, netPosition){ 
	// To prevent the ball from getting stuck in the net (bouncing between its two inner walls),
	// we check the direction that the ball is going
	if (ballPosition.dx > 0) return ballIsUnderTopOfNet(ballPosition, netPosition) && ballIsCloseToLeftSideOfNet(ballPosition, netPosition);  // Moving right
	else return ballIsUnderTopOfNet(ballPosition, netPosition) && ballIsCloseToRightSideOfNet(ballPosition, netPosition);  // Moving left
}

/**
 * Checks if the ball will pass through the net when it moves this tick.
 * @param {import("./game_controller.js").Position} ballPosition 
 * @param {import("./game_controller.js").Position} netPosition 
 * @returns {Boolean}
 */
function ballIsPassingThroughNet(ballPosition, netPosition){
	// Connect the ball's current position, and its future position
	// Find the ball's y-height when it passes the two inner walls of the net
	// Check if the inner wall is relevant based on the direction the ball is headed
	// If the wall is relevant and we're lower than it, then the ball is passing through the net
	const netLeftBoundary = netPosition.x - netWidth / 2;
	const netRightBoundary = netPosition.x + netWidth / 2;

	const futureX = ballPosition.x + ballPosition.dx;
	const futureY = ballPosition.y + ballPosition.dy;

	// Ball won't pass through net if the distance travelled doesn't go over the X coords of the net
	if (ballPosition.x <= netLeftBoundary && futureX <= netLeftBoundary) return false;
	if (ballPosition.x >= netRightBoundary && futureX >= netRightBoundary) return false;

	const slope = (futureY - ballPosition.y) / (futureX - ballPosition.x);
	const ballYAtLeftBoundary = slope * (netLeftBoundary - ballPosition.x) + ballPosition.y;
	const ballYAtRightBoundary = slope * (netRightBoundary - ballPosition.x) + ballPosition.y;

	if (ballPosition.dx >= 0 && ballYAtLeftBoundary >= netPosition.y) return true;
	else if (ballPosition.dx <= 0 && ballYAtRightBoundary >= netPosition.y) return true;
	else return false;
}

function isTouching(playerPosition, ballPosition){
	return Math.sqrt(
		(playerPosition.x - ballPosition.x) ** 2 + 
		(playerPosition.y - ballPosition.y) ** 2
	) < playerRadius + ballRadius;
}

/**
 * Update the velocities of all game objects.
 * @param {import("./game_controller.js").GameState} gameState
 */
function runPhysicsCalculations(gameState){
	const inputs = gameState.inputs;
	const positions = gameState.positions;

	// Update player velocities
	for (const playerID of ["player1", "player2"]){
		const inputSet = inputs[playerID];

		// Handle horizontal movement
		if (isMovingLeft(inputSet)) positions[playerID].dx -= 5;
		if (isMovingRight(inputSet)) positions[playerID].dx += 5;

		// Friction
		positions[playerID].dx *= 0.6;

		// Handle vertical movement
		// If the player is on / in the ground, stop falling
		if (isGrounded(positions[playerID], playerRadius)) positions[playerID].dy = 0;

		// Jumping
		if (isJumping(inputSet) && isGrounded(positions[playerID], playerRadius)) positions[playerID].dy -= 30;

		// Gravity
		if (!isGrounded(positions[playerID], playerRadius)) positions[playerID].dy += 1.5;
	}

	// Update ball velocities
	// If the ball is on / in the ground, bounce perfectly elastically
	if (isGrounded(positions.ball, ballRadius)) positions.ball.dy *= -1;

	// Gravity
	if (!isGrounded(positions.ball, ballRadius)) positions.ball.dy += 1;

	// If the ball touches a side wall, bounce perfectly elastically
	if (ballIsInSideWall(positions.ball)) positions.ball.dx *= -1;

	// If the ball hits the ceiling, bounce perfectly elastically
	if (ballIsInCeiling(positions.ball)) positions.ball.dy *= -1;

	// If the ball touches a player, override the velocity entirely (send at a fixed speed, relative to angle between player and ball)
	for (const playerID of ["player1", "player2"]){
		const playerPosition = positions[playerID];
		const ballPosition = positions.ball;

		if (isTouching(playerPosition, ballPosition)){
			// Calculate angle between player and ball
			const angle = Math.atan2(ballPosition.y - playerPosition.y, ballPosition.x - playerPosition.x);

			// Bounce ball off of player
			const totalVelocity = isSmacking(inputs[playerID]) ? 40 : 25;
			ballPosition.dx = totalVelocity * Math.cos(angle);
			ballPosition.dy = totalVelocity * Math.sin(angle);
		}
	}

	// Ball always bounces off net elastically
	if (ballIsInNet(positions.ball, positions.net)) positions.ball.dx *= -1;
}

module.exports = { runPhysicsCalculations, ballIsPassingThroughNet };