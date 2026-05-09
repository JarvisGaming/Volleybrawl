const playerRadius = 50;
const ballRadius = 25;

const context = $("#game-canvas").get(0).getContext("2d");
let frameCounter = 0;


function roundedRectPath(ctx, x, y, width, height, radius){
	const r = Math.min(radius, width / 2, height / 2);
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + width - r, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + r);
	ctx.lineTo(x + width, y + height - r);
	ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
	ctx.lineTo(x + r, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
}

function loadImage(src){
	const image = new Image();
	image.src = src;
	return image;
}

const assets = {
	court: loadImage("/assets/images/court.png"),
	player1: loadImage("/assets/images/player_red_sprites.png"),
	player2: loadImage("/assets/images/player_blue_sprites.png"),
	ball: loadImage("/assets/images/volley_orb.png"),
	spark: loadImage("/assets/images/impact_spark.png"),
	netPost: loadImage("/assets/images/net_post.png"),
};

function imageReady(image){
	return image.complete && image.naturalWidth > 0;
}

function drawFallbackBackground(){
	const gradient = context.createLinearGradient(0, 0, 0, context.canvas.height);
	gradient.addColorStop(0, "#8fd7ff");
	gradient.addColorStop(0.55, "#74be79");
	gradient.addColorStop(1, "#f2c35d");
	context.fillStyle = gradient;
	context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

function drawBackground(){
	if (imageReady(assets.court)) {
		context.drawImage(assets.court, 0, 0, context.canvas.width, context.canvas.height);
	}
	else {
		drawFallbackBackground();
	}
}

function drawNet(net){
	context.save();

	const top = net.y;
	const bottom = context.canvas.height;
	const poleX = Math.round(net.x);

	// Original-style slim net post: red/white pole with a small ring cap.
	context.fillStyle = "rgba(0, 0, 0, 0.32)";
	context.fillRect(poleX - 8, top + 6, 16, bottom - top);

	context.fillStyle = "#1f1715";
	context.fillRect(poleX - 6, top, 12, bottom - top);
	context.fillStyle = "#e13636";
	context.fillRect(poleX - 4, top + 2, 8, bottom - top - 2);
	context.fillStyle = "#fff7eb";
	context.fillRect(poleX - 1, top + 4, 2, bottom - top - 4);

	// Tiny pixel-highlight segments make it read like a 16-bit net pole.
	context.globalAlpha = 0.72;
	context.fillStyle = "#7b1b1b";
	for (let y = top + 16; y < bottom - 12; y += 24) {
		context.fillRect(poleX + 3, y, 2, 10);
	}
	context.globalAlpha = 1;

	context.fillStyle = "#fff7eb";
	context.strokeStyle = "#e13636";
	context.lineWidth = 3;
	context.beginPath();
	context.arc(poleX, top, 8, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.strokeStyle = "#1f1715";
	context.lineWidth = 1;
	context.stroke();

	context.restore();
}

function drawCooldown(player){
	const remaining = player.smackCooldownRemaining || 0;
	if (remaining <= 0) return;

	const max = 500;
	const ratio = Math.min(1, remaining / max);
	const width = 64;
	const height = 8;
	const x = player.x - width / 2;
	const y = player.y - 84;
	context.save();
	context.fillStyle = "rgba(20, 22, 28, 0.35)";
	context.fillRect(x, y, width, height);
	context.fillStyle = "rgba(255, 222, 68, 0.95)";
	context.fillRect(x, y, width * (1 - ratio), height);
	context.strokeStyle = "rgba(40, 25, 10, 0.75)";
	context.lineWidth = 2;
	context.strokeRect(x, y, width, height);
	context.restore();
}

function drawCheatBadge(player){
	if (!player.cheatMode) return;

	context.save();
	const text = "CHEAT";
	context.font = "bold 17px Helvetica, sans-serif";
	const width = context.measureText(text).width + 24;
	const x = player.x - width / 2;
	const y = Math.max(12, player.y - 126);
	context.fillStyle = "rgba(20, 22, 28, 0.82)";
	context.strokeStyle = "rgba(255, 235, 75, 0.95)";
	context.lineWidth = 2;
	context.beginPath();
	roundedRectPath(context, x, y, width, 28, 12);
	context.fill();
	context.stroke();
	context.fillStyle = "#ffef5b";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(text, player.x, y + 15);
	context.restore();
}

function drawSmackAura(player){
	void player;
}

function drawFallbackPlayer(player, color){
	context.save();
	context.fillStyle = color;
	context.strokeStyle = "#3c2b15";
	context.lineWidth = 4;
	context.beginPath();
	context.arc(player.x, player.y, playerRadius, 0, 2 * Math.PI);
	context.fill();
	context.stroke();
	context.fillStyle = "#fff4a3";
	context.beginPath();
	context.arc(player.x - 15, player.y - 12, 5, 0, 2 * Math.PI);
	context.arc(player.x + 15, player.y - 12, 5, 0, 2 * Math.PI);
	context.fill();
	context.restore();
}

function selectPlayerFrame(player){
	const facingLeft = player.facing === "left" || (!player.facing && player.dx < 0);
	const sideOffset = facingLeft ? 1 : 0;
	const isMoving = Math.abs(player.dx || 0) > 0.45;
	const isAirborne = player.y < context.canvas.height - playerRadius - 8;

	// Sprite sheet order:
	// 0 idle-right, 1 idle-left, 2 move-right-A, 3 move-left-A,
	// 4 move-right-B, 5 move-left-B, 6 jump-right, 7 jump-left,
	// 8 smack-right, 9 smack-left, 10 powered-smack-right, 11 powered-smack-left.
	if (player.smacking && player.cheatMode) return 10 + sideOffset;
	if (player.smacking) return 8 + sideOffset;
	if (isAirborne) return 6 + sideOffset;
	if (isMoving) return (frameCounter % 18 < 9 ? 2 : 4) + sideOffset;
	return sideOffset;
}

function drawCheatElectricity(player){
	if (!player.cheatMode) return;

	context.save();
	context.globalAlpha = 0.7 + Math.sin(frameCounter * 0.35) * 0.12;
	context.strokeStyle = "#fff25a";
	context.fillStyle = "#fff25a";
	context.lineWidth = 3;
	context.lineJoin = "round";

	const sparks = [
		[-62, -62, -50, -76, -54, -56, -40, -66],
		[58, -64, 72, -72, 64, -52, 80, -58],
		[-70, 6, -88, 12, -66, 20],
		[70, 5, 88, -2, 78, 18],
	];
	const wobble = Math.sin(frameCounter * 0.21) * 2;
	for (const spark of sparks) {
		context.beginPath();
		context.moveTo(player.x + spark[0], player.y + spark[1] + wobble);
		for (let i = 2; i < spark.length; i += 2) {
			context.lineTo(player.x + spark[i], player.y + spark[i + 1] - wobble);
		}
		context.stroke();
	}

	for (const [x, y] of [[-83, -34], [84, -39], [-58, 34], [62, 31]]) {
		context.beginPath();
		context.arc(player.x + x, player.y + y, 3, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
}

function drawPlayer(playerID, player){
	const sheet = playerID === "player1" ? assets.player1 : assets.player2;
	const accent = playerID === "player1" ? "#ff5b5b" : "#448dff";

	// Ground shadow.
	context.save();
	context.fillStyle = "rgba(10, 20, 20, 0.20)";
	context.beginPath();
	context.ellipse(player.x, player.y + playerRadius - 5, 45, 12, 0, 0, Math.PI * 2);
	context.fill();
	context.restore();

	drawCheatElectricity(player);

	if (imageReady(sheet)) {
		const frame = selectPlayerFrame(player);
		const drawSize = 118;
		context.drawImage(
			sheet,
			frame * 128, 0, 128, 128,
			player.x - drawSize / 2,
			player.y + playerRadius - drawSize,
			drawSize,
			drawSize,
		);
	}
	else {
		drawFallbackPlayer(player, accent);
	}

	drawCooldown(player);
	drawCheatBadge(player);
}

function drawBall(ball){
	const speed = Math.hypot(ball.dx || 0, ball.dy || 0);
	context.save();

	// Fast-ball trail, especially useful in cheat mode.
	if (speed > 34) {
		context.globalAlpha = 0.23;
		context.fillStyle = "#fff25a";
		for (let i = 1; i <= 4; i++) {
			context.beginPath();
			context.arc(ball.x - (ball.dx || 0) * i * 0.34, ball.y - (ball.dy || 0) * i * 0.34, ballRadius * (1 - i * 0.12), 0, Math.PI * 2);
			context.fill();
		}
		context.globalAlpha = 1;
	}

	context.translate(ball.x, ball.y);
	context.rotate((frameCounter * 0.09) + (ball.x + ball.y) / 90);
	if (imageReady(assets.ball)) {
		context.drawImage(assets.ball, -ballRadius, -ballRadius, ballRadius * 2, ballRadius * 2);
	}
	else {
		context.fillStyle = "#f24545";
		context.beginPath();
		context.arc(0, 0, ballRadius, 0, Math.PI * 2);
		context.fill();
		context.strokeStyle = "#222";
		context.lineWidth = 3;
		context.stroke();
	}
	context.restore();
}

function drawDebugHints(){
	// Controls are shown in the page HUD. Keeping the canvas clean makes the
	// playfield closer to the original retro volleyball look.
}

export function drawGameFrame(positions){
	/**
	 * @type {CanvasRenderingContext2D}
	 */
	frameCounter++;
	context.clearRect(0, 0, context.canvas.width, context.canvas.height);

	drawBackground();
	// The generated background already contains the retro court lighting/detail.

	// Draw back player first by Y position for a small sense of depth.
	const players = [
		["player1", positions.player1],
		["player2", positions.player2],
	].sort((a, b) => a[1].y - b[1].y);

	// Ball and players are drawn before the net so the net can visually block low shots.
	for (const [playerID, player] of players) drawPlayer(playerID, player);
	drawBall(positions.ball);
	drawNet(positions.net);
	drawDebugHints();
};
