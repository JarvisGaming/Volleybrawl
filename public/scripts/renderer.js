const playerRadius = 50;
const ballRadius = 25;
const netWidth = 15;

export function drawGameFrame(positions){
	/**
	 * @type {CanvasRenderingContext2D}
	 */
	const context = $("#game-canvas").get(0).getContext("2d");
	context.clearRect(0, 0, context.canvas.width, context.canvas.height);

	class Sprite {
		constructor(x, y){
			this.x = x;
			this.y = y;
		}
	}

	class Circle extends Sprite {
		constructor(x, y, radius, color){
			super(x, y);
			this.radius = radius;
			this.color = color;
		}
		draw(){
			context.beginPath();
			context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
			context.fillStyle = this.color;
			context.fill();
		}
	}

	class Net extends Sprite {
		constructor(x, y, width, color){
			super(x, y);
			this.width = width;
			this.color = color;
		}
		draw(){
			context.beginPath();
			context.rect(this.x - this.width / 2, this.y, this.width, context.canvas.height - this.y);
			context.fillStyle = this.color;
			context.fill();
		}
	}

	// Players
	const player1 = new Circle(positions.player1.x, positions.player1.y, playerRadius, "red");
	player1.draw();

	const player2 = new Circle(positions.player2.x, positions.player2.y, playerRadius, "blue");
	player2.draw();

	// Ball
	const ball = new Circle(positions.ball.x, positions.ball.y, ballRadius, "green");
	ball.draw();

	// Net
	const net = new Net(positions.net.x, positions.net.y, netWidth, "orange");
	net.draw();
};