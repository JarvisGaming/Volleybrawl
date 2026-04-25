const { clamp, PLAYER_RADIUS, BALL_RADIUS, SMACK_RADIUS, NET_WIDTH, GAMEFIELD_WIDTH, GAMEFIELD_HEIGHT, SMACK_COOLDOWN_MILLI } = require("./shared.js");

const PLAYER_HORIZONTAL_SPEED = 5;
const PLAYER_JUMP_INITIAL_VELOCITY = 30;
const FRICTION_COEFFICIENT = 0.6;
const PLAYER_GRAVITY = 1.5;
const BALL_GRAVITY = 1;
const BALL_PLAYER_CONTACT_VELOCITY = 25;
const BALL_PLAYER_SMACK_VELOCITY = 40;

function distance(pos1, pos2){ return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2); }

function isGrounded(position, radius){ return position.y + radius >= GAMEFIELD_HEIGHT; }

function isMovingLeft(inputSet){ return inputSet.has("ArrowLeft"); }
function isMovingRight(inputSet){ return inputSet.has("ArrowRight"); }
function isJumping(inputSet){ return inputSet.has("ArrowUp"); }
function isSmacking(inputSet){ return inputSet.has(" "); }

function isSmackSuccessful(playerPosition, ballPosition){ return distance(playerPosition, ballPosition) <= SMACK_RADIUS; }
function isSmackOnCooldown(lastSmackTimestamp){ return Date.now() - lastSmackTimestamp < SMACK_COOLDOWN_MILLI; }

function ballIsInSideWall(ballPosition){ return ballPosition.x - BALL_RADIUS <= 0 || ballPosition.x + BALL_RADIUS >= GAMEFIELD_WIDTH; }
function ballIsInCeiling(ballPosition){ return ballPosition.y <= BALL_RADIUS; }
function ballIsUnderTopOfNet(ballPosition, netPosition) { return ballPosition.y >= netPosition.y; }
function ballIsCloseToLeftSideOfNet(ballPosition, netPosition) { return Math.abs(ballPosition.x - (netPosition.x - NET_WIDTH / 2)) <= BALL_RADIUS; }
function ballIsCloseToRightSideOfNet(ballPosition, netPosition) { return Math.abs(ballPosition.x - (netPosition.x + NET_WIDTH / 2)) <= BALL_RADIUS; }

function ballIsInNet(ballPosition, netPosition){ 
	// To prevent the ball from getting stuck in the net (bouncing between its two inner walls),
	// we check the direction that the ball is going
	if (ballPosition.dx > 0) return ballIsUnderTopOfNet(ballPosition, netPosition) && ballIsCloseToLeftSideOfNet(ballPosition, netPosition);  // Moving right
	else return ballIsUnderTopOfNet(ballPosition, netPosition) && ballIsCloseToRightSideOfNet(ballPosition, netPosition);  // Moving left
}

/**
 * Checks if the ball will pass through the net when it moves this tick.
 * @param {import("./controllers/game_controller.js").Position} ballPosition 
 * @param {import("./controllers/game_controller.js").Position} netPosition 
 * @returns {Boolean}
 */
function ballIsPassingThroughNet(ballPosition, netPosition){
	// Connect the ball's current position, and its future position
	// Find the ball's y-height when it passes the two inner walls of the net
	// Check if the inner wall is relevant based on the direction the ball is headed
	// If the wall is relevant and we're lower than it, then the ball is passing through the net
	const netLeftBoundary = netPosition.x - NET_WIDTH / 2;
	const netRightBoundary = netPosition.x + NET_WIDTH / 2;

	const futureX = ballPosition.x + ballPosition.dx;
	const futureY = ballPosition.y + ballPosition.dy;

	// Ball won't pass through net if the distance travelled doesn't go over the X coords of the net
	if (ballPosition.x <= netLeftBoundary && futureX <= netLeftBoundary) return false;
	if (ballPosition.x >= netRightBoundary && futureX >= netRightBoundary) return false;

	// (futureX - ballPosition.x) will never be zero, unless you can stop the ball dead center right above the net
	const slope = (futureY - ballPosition.y) / (futureX - ballPosition.x);

	const ballYAtLeftBoundary = slope * (netLeftBoundary - ballPosition.x) + ballPosition.y;
	const ballYAtRightBoundary = slope * (netRightBoundary - ballPosition.x) + ballPosition.y;

	if (ballPosition.dx >= 0 && ballYAtLeftBoundary >= netPosition.y) return true;
	else if (ballPosition.dx <= 0 && ballYAtRightBoundary >= netPosition.y) return true;
	else return false;
}

function player1Scored(ballPosition){ return isGrounded(ballPosition, BALL_RADIUS) && ballPosition.x >= GAMEFIELD_WIDTH / 2; }
function player2Scored(ballPosition){ return isGrounded(ballPosition, BALL_RADIUS) && ballPosition.x <= GAMEFIELD_WIDTH / 2; }

function isTouching(playerPosition, ballPosition){ return distance(playerPosition, ballPosition) < PLAYER_RADIUS + BALL_RADIUS; }

/**
 * Update the velocities of all game objects.
 * Also updated relevant player statistics.
 * @param {import("./controllers/game_controller.js").GameState} gameState
 */
function runPhysicsCalculations(gameState){
	const inputs = gameState.inputs;
	const positions = gameState.positions;

	// Update player velocities
	updatePlayerPhysics(inputs, positions, gameState);

	// Update ball velocity
	updateBallPhysics(inputs, positions, gameState);
}

/**
 * Update player velocities based on player input and wall interactions.
 * @param {{
 * 	 player1: Set<string>,
 * 	 player2: Set<string>,
 * }} inputs 
 * @param {Positions} positions 
 * @param {GameState} gameState 
 */
function updatePlayerPhysics(inputs, positions, gameState) {
	for (const playerID of ["player1", "player2"]) {
		const inputSet = inputs[playerID];

		// Handle horizontal movement
		if (isMovingLeft(inputSet)) positions[playerID].dx -= PLAYER_HORIZONTAL_SPEED;
		if (isMovingRight(inputSet)) positions[playerID].dx += PLAYER_HORIZONTAL_SPEED;

		// Friction
		positions[playerID].dx *= FRICTION_COEFFICIENT;

		// Handle vertical movement
		// If the player is on / in the ground, stop falling
		if (isGrounded(positions[playerID], PLAYER_RADIUS)) positions[playerID].dy = 0;

		// Jumping
		if (isJumping(inputSet) && isGrounded(positions[playerID], PLAYER_RADIUS)) {
			positions[playerID].dy -= PLAYER_JUMP_INITIAL_VELOCITY;
			gameState.statistics[playerID].numJumps++;
		}

		// Gravity
		if (!isGrounded(positions[playerID], PLAYER_RADIUS)) positions[playerID].dy += PLAYER_GRAVITY;
	}
}


/**
 * Update ball velocity based on player and wall interaction.
 * @param {{
 * 	 player1: Set<string>,
 * 	 player2: Set<string>,
 * }} inputs 
 * @param {Positions} positions 
 * @param {GameState} gameState 
 */
function updateBallPhysics(inputs, positions, gameState) {
	// If the ball is on / in the ground, bounce perfectly elastically
	if (isGrounded(positions.ball, BALL_RADIUS)) positions.ball.dy *= -1;

	// Gravity
	if (!isGrounded(positions.ball, BALL_RADIUS)) positions.ball.dy += BALL_GRAVITY;

	// If the ball touches a side wall, bounce perfectly elastically
	if (ballIsInSideWall(positions.ball)) positions.ball.dx *= -1;

	// If the ball hits the ceiling, bounce perfectly elastically
	if (ballIsInCeiling(positions.ball)) positions.ball.dy *= -1;

	// If the ball touches a player, override the velocity entirely (send at a fixed speed, relative to angle between player and ball)
	for (const playerID of ["player1", "player2"]) {
		const playerPosition = positions[playerID];
		const ballPosition = positions.ball;

		function updateBallSmackVelocity(totalVelocity) {
			// Calculate angle between player and ball
			const angle = Math.atan2(ballPosition.y - playerPosition.y, ballPosition.x - playerPosition.x);

			// Bounce ball off of player
			ballPosition.dx = totalVelocity * Math.cos(angle);
			ballPosition.dy = totalVelocity * Math.sin(angle);
		}

		if (isTouching(playerPosition, ballPosition)) {
			updateBallSmackVelocity(BALL_PLAYER_CONTACT_VELOCITY);
		}

		// Player smacking off cooldown
		if (isSmacking(inputs[playerID]) && !isSmackOnCooldown(gameState.lastSmack[playerID])) {
			// Apply smack cooldown, regardless of whether the player hit the ball
			gameState.lastSmack[playerID] = Date.now();

			if (isSmackSuccessful(playerPosition, ballPosition)) {
				updateBallSmackVelocity(BALL_PLAYER_SMACK_VELOCITY);
				gameState.statistics[playerID].numSmacks++;
			}
		}
	}

	// Ball always bounces off net elastically
	if (ballIsInNet(positions.ball, positions.net)) positions.ball.dx *= -1;
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
		if (positions.ball.dx >= 0) positions.ball.x = positions.net.x - BALL_RADIUS;

		// Clamp to right of net
		else if (positions.ball.dx <= 0) positions.ball.x = positions.net.x + BALL_RADIUS;
	}
	else { positions.ball.x += positions.ball.dx; }
	positions.ball.y += positions.ball.dy;

	// Clamp player position to their side of the net
	positions["player1"].y = clamp(positions["player1"].y, PLAYER_RADIUS, GAMEFIELD_HEIGHT - PLAYER_RADIUS);
	positions["player1"].x = clamp(positions["player1"].x, PLAYER_RADIUS, positions.net.x - NET_WIDTH / 2 - PLAYER_RADIUS);

	positions["player2"].y = clamp(positions["player2"].y, PLAYER_RADIUS, GAMEFIELD_HEIGHT - PLAYER_RADIUS);
	positions["player2"].x = clamp(positions["player2"].x, positions.net.x + NET_WIDTH / 2 + PLAYER_RADIUS, GAMEFIELD_WIDTH - PLAYER_RADIUS);

	// Clamp ball position
	positions.ball.y = clamp(positions.ball.y, BALL_RADIUS, GAMEFIELD_HEIGHT - BALL_RADIUS);
	positions.ball.x = clamp(positions.ball.x, 0 + BALL_RADIUS, GAMEFIELD_WIDTH - BALL_RADIUS);
}

module.exports = { runPhysicsCalculations, updatePositions, player1Scored, player2Scored };