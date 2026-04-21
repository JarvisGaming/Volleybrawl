const { clamp, playerRadius, ballRadius, smackRadius, netWidth, gamefieldWidth, gamefieldHeight, smackCooldownMilli } = require("./shared.js");

function distance(pos1, pos2){ return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2); }

function isGrounded(position, radius){ return position.y + radius >= gamefieldHeight; }

function isMovingLeft(inputSet){ return inputSet.has("ArrowLeft"); }
function isMovingRight(inputSet){ return inputSet.has("ArrowRight"); }
function isJumping(inputSet){ return inputSet.has("ArrowUp"); }
function isSmacking(inputSet){ return inputSet.has(" "); }

function isSmackSuccessful(playerPosition, ballPosition){ return distance(playerPosition, ballPosition) <= smackRadius; }
function isSmackOnCooldown(lastSmackTimestamp){ return Date.now() - lastSmackTimestamp < smackCooldownMilli; }

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
 * @param {import("./controller/game_controller.js").Position} ballPosition 
 * @param {import("./controller/game_controller.js").Position} netPosition 
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

function player1Scored(ballPosition){ return isGrounded(ballPosition, ballRadius) && ballPosition.x >= gamefieldWidth / 2; }
function player2Scored(ballPosition){ return isGrounded(ballPosition, ballRadius) && ballPosition.x <= gamefieldWidth / 2; }

function isTouching(playerPosition, ballPosition){ return distance(playerPosition, ballPosition) < playerRadius + ballRadius; }

/**
 * Update the velocities of all game objects.
 * Also updated relevant player statistics.
 * @param {import("./controller/game_controller.js").GameState} gameState
 */
function runPhysicsCalculations(gameState){
	const inputs = gameState.inputs;
	const positions = gameState.positions;

	/**
	 * Update player velocities
	 */
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
		if (isJumping(inputSet) && isGrounded(positions[playerID], playerRadius)) {
			positions[playerID].dy -= 30;
			gameState.statistics[playerID].numJumps++;
		}

		// Gravity
		if (!isGrounded(positions[playerID], playerRadius)) positions[playerID].dy += 1.5;
	}


	/**
	 * Update ball velocity.
	 */
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

		function updateBallSmackVelocity(totalVelocity){
			// Calculate angle between player and ball
			const angle = Math.atan2(ballPosition.y - playerPosition.y, ballPosition.x - playerPosition.x);

			// Bounce ball off of player
			ballPosition.dx = totalVelocity * Math.cos(angle);
			ballPosition.dy = totalVelocity * Math.sin(angle);
		}

		if (isTouching(playerPosition, ballPosition)){
			updateBallSmackVelocity(25);
		}

		// Player smacking off cooldown
		if (isSmacking(inputs[playerID]) && !isSmackOnCooldown(gameState.lastSmack[playerID])){
			// Apply smack cooldown, regardless of whether the player hit the ball
			gameState.lastSmack[playerID] = Date.now();
			
			if (isSmackSuccessful(playerPosition, ballPosition)){
				updateBallSmackVelocity(40);
				gameState.statistics[playerID].numSmacks++;
			}
		}
	}

	// Ball always bounces off net elastically
	if (ballIsInNet(positions.ball, positions.net)) positions.ball.dx *= -1;

	// console.dir(gameState.statistics, {depth: null});
}

/**
 * Move the players, the net, and the ball based on velocity.
 * @param {Positions} positions 
 */
function updatePositions(positions){
	// Handle ball updates separately to prevent it from phasing through net
	for (const gameObject of Object.keys(positions)){
		if (gameObject == "ball") continue;
		positions[gameObject].x += positions[gameObject].dx;
		positions[gameObject].y += positions[gameObject].dy;
	}

	// Prevent ball from phasing through net
	if (ballIsPassingThroughNet(positions.ball, positions.net)){
		// Clamp to left of net
		if (positions.ball.dx >= 0) positions.ball.x = positions.net.x - ballRadius;

		// Clamp to right of net
		else if (positions.ball.dx <= 0) positions.ball.x = positions.net.x + ballRadius;
	}
	else { positions.ball.x += positions.ball.dx; }
	positions.ball.y += positions.ball.dy;

	// Clamp player position to their side of the net
	positions["player1"].y = clamp(positions["player1"].y, playerRadius, gamefieldHeight - playerRadius);
	positions["player1"].x = clamp(positions["player1"].x, playerRadius, positions.net.x - netWidth / 2 - playerRadius);

	positions["player2"].y = clamp(positions["player2"].y, playerRadius, gamefieldHeight - playerRadius);
	positions["player2"].x = clamp(positions["player2"].x, positions.net.x + netWidth / 2 + playerRadius, gamefieldWidth - playerRadius);

	// Clamp ball position
	positions.ball.y = clamp(positions.ball.y, ballRadius, gamefieldHeight - ballRadius);
	positions.ball.x = clamp(positions.ball.x, 0 + ballRadius, gamefieldWidth - ballRadius);
}

module.exports = { runPhysicsCalculations, updatePositions, ballIsPassingThroughNet, player1Scored, player2Scored };