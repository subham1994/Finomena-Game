const PORT = process.env.PORT || 3000;
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Timer = require('timer.js');
const timer = new Timer();

const colors = ['#2c3e50', '#e74c3c', '#8e44ad', '#2ecc71', '#ea4c88'];
const users = {};
const sockets = [];
const bonusPointLocations = [];
let gameConfigured = false;
let gameStarted = false;
let waitingForNewPlayer = false;
let playerNum = 1;
let numTiles = 16;
let currentlyPlaying = 0;
let maxPlayers = 2;
let gameDuration = 30;
let pauseDuration = 3;
let newUser;


app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

io.on('connection', (socket) => {
	sockets.push(socket);

	// show the timer 
	timer.on('tick', (ms) => {
		io.emit('tick', { secondsLeft: Math.ceil(ms / 1000) });
	});

	// time to announce the winner
	timer.on('end', () => {
		let maxScore = -1;
		let winner;
		for (const socketId in users) {
			if (users[socketId].score >= maxScore) {
				winner = Object.assign({}, { name: users[socketId].name }, { socketId });
				maxScore = users[socketId].score;
			}
		}
		io.emit('timeout', winner);
		sockets.forEach((socket) => {
			socket.disconnect();
		});
	});

	// structure of user object
	users[socket.id] = {
		name: newUser,
		color: colors.pop(),
		playerNum: playerNum++,
		tiles: [],
		score: 0
	}

	// increment count if a user joins in
	currentlyPlaying++;

	// When to start the game?
	if (gameConfigured) {
		// paint the board on the screen with appropriate colors on atleast 2 players
		if (currentlyPlaying > 1 && gameStarted) {
			if (waitingForNewPlayer) {
				waitingForNewPlayer = false;
				timer.start();
				io.emit('draw grid', Object.assign({}, { users }, { numTiles }));
			} else {
				// if game has already started, paint only new user's screen
				socket.emit('draw grid', Object.assign({}, { users }, { numTiles }));
			}
		} else if (currentlyPlaying > 1 && !gameStarted) {
			// if game hasn't yet started, paint everyone's screen who have joined the game
			io.emit('draw grid', Object.assign({}, { users }, { numTiles }));
			timer.start(gameDuration);
			gameStarted = true;
		}
	} else {
		// wait for game to start
		socket.emit('pre game', { msg: 'Waiting for game configurations !' });
	}

	// do all the setup work
	socket.emit('join', users[socket.id]);
	// build the sidebar listing current players
	io.emit('user change', users);

	// as soon as game is configured, store all the config params and add bonus points
	socket.on('start game', function({ row, col, maxPlrs, pauseDur, gameDur }) {
		gameConfigured = true;
		const numTiles = parseInt(row, 10) * parseInt(col, 10);
		maxPlayers = parseInt(maxPlrs, 10);
		pauseDuration = parseInt(pauseDur, 10);
		gameDuration = parseInt(gameDur, 10);
		// get two random location to hide bonus points
		const firstLocation = Math.ceil(Math.random() * numTiles);
		let secondLocation;
		do {
			secondLocation = Math.ceil(Math.random() * numTiles);
		} while (firstLocation === secondLocation);
		bonusPointLocations.unshift(firstLocation, secondLocation);

		if (currentlyPlaying > 1) {
			// if game hasn't yet started, paint everyone's screen who have joined the game
			io.emit('draw grid', Object.assign({}, { users }, { numTiles }));
			timer.start(gameDuration);
			gameStarted = true;
		} else {
			// wait for another player to join in
			socket.emit('pre game', { msg: 'Waiting for another player to join in !' });
		}
	});

	// fired when user conquers a tile
	socket.on('tile click', ({ tileId }) => {
		const pauseTimer = new Timer();
		const user = users[socket.id]
		// check if the tile is a bonus tile
		if (bonusPointLocations.indexOf(parseInt(tileId.split('-')[1], 10)) > -1) {
			// notify the user
			socket.emit('notification', {
				text: 'Congrats, You earned 3 extra points !',
				type: 'info'
			});

			// notify other users
			socket.broadcast.emit('notification', {
				text: `${user.name} just unlocked 3 extra points !`,
				type: 'info'
			});

			// reward extra points along with usual points
			user.score += 3;
		}

		// increment score by 1
		user.score += 1;
		// add it to user's tiles array to keep track of all the tiles
		user.tiles.push(tileId);
		// tell everyone somebody has occupied a tile
		socket.broadcast.emit('tile change', { user, tileId });
		// update the scores on the sidebar
		io.emit('user change', users);

		// when a tile is clicked wait for a specified amount of time
		pauseTimer.on('tick', (ms) => {
			io.emit('paused', { secondsLeft: Math.ceil(ms / 1000) });
		});
		pauseTimer.on('end', () => {
			if (timer.getDuration()) {
				timer.start();
			}
			io.emit('resume game');
		});
		timer.pause();
		io.emit('pause game', { seconds: pauseDuration })
		pauseTimer.start(pauseDuration);
	});

	socket.on('disconnect', () => {
		// if a user disconnects, remove it from the users object
		currentlyPlaying--;
		const user = users[socket.id];
		delete users[socket.id];
		// take the color of the user and make it available again
		colors.push(user.color);
		// update the sidebar
		io.emit('user change', users);
		// unlock all its occupied tiles for others to occupy 
		io.emit('unlock tiles', user);

		// reset game config if everyone leaves game or game ends
		if (!currentlyPlaying) {
			playerNum = 1;
			gameConfigured = false;
			gameStarted = false;
			waitingForNewPlayer = false;
		} else if (currentlyPlaying === 1) {
			// if there is only one player left in the game, wait for another player to join in
			timer.pause();
			waitingForNewPlayer = true;
			io.emit('pre game', { msg: 'Waiting for another player to join in !' });
		}
	});
});

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/public/index.html');
});

app.post('/game', (req, res) => {
	// if max players limit is reached, redirect them to the home page
	if (currentlyPlaying === maxPlayers) {
		res.redirect('/');
	}
	newUser = req.body.username;
	res.sendFile(__dirname + '/public/game.html');
});

app.get('/game', (req, res) => {
	// if trying to open game page directly without providing username,
	// Redirect them back to homepage to fill the form
	res.redirect('/');
})

http.listen(PORT, () => {
	console.log('listening on port 3000');
});