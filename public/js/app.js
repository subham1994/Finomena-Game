$(document).ready(function() {
	
	$('select').material_select();

	$('.modal').modal({
		dismissible: false, // Modal can be dismissed by clicking outside of the modal
		opacity: 1, // Opacity of modal background
	});

	var socket = io();
	var $playersList = $('#players-list');
	var occupiedTiles = [];
	var $counter = $('#counter');

	function getTileColor(users, tileId) {
		for (var socketId in users) {
			var user = users[socketId]
			if (user.tiles.indexOf(tileId) > -1) {
				return user.color;
			}
		}
		return undefined;
	}

	function showToast(text) {
		var content = '<strong>' + text + '</strong>';
		var $notification = $(content);
		Materialize.toast($notification, 3000);
	}

	function showNotificationBanner(imgSrc, $text) {
		var $notification = $('#notification');
		$notification.css('display', 'inherit');
		$notification.html('')
		var $notificationCol = $('<div class="col l12 s12 m12"></div>');
		var $notificationCard = $('<div class="card-panel center"></div>')
		var $image = $('<img src="' + imgSrc + '"></img>');
		$notificationCard.append($image);
		$notificationCard.append($text);
		$notification.append($notificationCol.append($notificationCard));
	}

	socket.on('notification', function(notif) {
		showToast(notif.text);
	});

	socket.on('join', function(user) {
		color = user.color;
		username = user.name;

		// show welcome message
		showToast('Welcome to Finomenal Board game');


		// ask the user to configure game if he is the first one to join
		if (user.playerNum === 1) {
			$('#configuration-modal').modal('open');

			$('#configuration-form').on('submit', function(event) {
				event.preventDefault();
				socket.emit('start game', {
					row: $('select[name=row]').val() || 4,
					col: 4,
					maxPlrs: $('select[name=maxplrs]').val() || 2,
					pauseDur: $('select[name=pausedur]').val() || 2,
					gameDur: $('select[name=gamedur]').val() || 30
				});
				$('#configuration-modal').modal('close');
			});
		}
	});

	socket.on('pre game', function(notif) {
		$('#tiles').css('display', 'none');
		var $text = $('<h3 class="pause-text">' + notif.msg  + '</h3>');
		showNotificationBanner('icons/hourglass.png', $text);
	});

	socket.on('draw grid', function(board) {
		// create the grid with appropriate colors
		$('#notification').css('display', 'none');
		var users = board.users;
		var numTiles = board.numTiles;
		var $tiles = $('#tiles');
		$tiles.css('display', 'inherit');
		$tiles.html('');
		for (var i = 1; i <= numTiles; i++) {
			// check if the tile is already occupied and paint accordingly
			var tileColor = getTileColor(users, 'tile-' + i) || '#FFF';
			// build the occupied tile tracker
			if (tileColor !== '#FFF') {
				occupiedTiles.push('tile-' + i);
			}
			// build the grid
			var $tileColumn = $('<div class="col l3 m4 s4"></div>');
			var $tile = $('<p class="game-tile z-depth-1" id="tile-' + i + '"></p>');
			$tile.css("background-color", tileColor);
			$tileColumn.append($tile);
			$tiles.append($tileColumn);
		}
	});

	socket.on('tick', function(time) {
		$counter.html('');
		$counter.html(time.secondsLeft  + ' S');
	});

	socket.on('pause game', function(time) {
		$('#tiles').css('display', 'none');
		var $text = $('<h3 class="pause-text">Game will resume in \
			<span style="color: #2196F3" id="remaining-time">' + time.seconds + '</span> second(s). \
		</h3>');
		showNotificationBanner('icons/stopwatch.png', $text);
	});

	socket.on('paused', function(time) {
		var $remainingTimeNode = $('#remaining-time');
		$remainingTimeNode.text('');
		$remainingTimeNode.text(time.secondsLeft);
	});

	socket.on('resume game', function() {
		$('#tiles').css('display', 'inherit');
		$('#notification').css('display', 'none');
	});

	socket.on('timeout', function(winner) {
		if (socket.id === winner.socketId) {
			$('#winner-desc').append('Congratulations, <span style="color: #2196F3">You</span> won the game !');
		} else {
			$('#winner-desc').append('<span style="color: #2196F3">' + winner.name + '</span> won the game !');
		}
		$('#winner-modal').modal('open');
	});

	socket.on('user change', function(users) {
		// initialize the counter
		$counter.html('');
		$counter.html('Timer');

		// recreate the sidebar
		$playersList.html('');
		
		var $header = $('\
		<li class="collection-header">\
			<h3 class="leaderboard-header center">Currently Playing</h3>\
		</li>');
		
		$playersList.append($header);
		
		for (var socketId in users) {
			let arrow = '';
			if (users[socketId].name === username && users[socketId].color === color) {
				arrow = '&#9658;';
			}
			var $list = $('\
				<li class="collection-item">'
					+ arrow + '<span class="new badge blue" data-badge-caption="tile(s)"><strong>' + users[socketId].score + '</strong></span>\
					<div class="chip" style="color: #FFF; background-color: ' + users[socketId].color + '">\
						<strong>' + users[socketId].name + '</strong>\
					</div>\
				</li>');
			$playersList.append($list);
		}
	});

	// update tile color if occupied by someone
	socket.on('tile change', function(data) {
		// keep track of occupied tiles
		occupiedTiles.push(data.tileId);
		showToast(data.user.name + ' conquered a tile !');
		$('#' + data.tileId).css("background-color", data.user.color);
	});

	// tiles get unlocked if some user leaves
	socket.on('unlock tiles', function(user) {
		var tiles = user.tiles;
		occupiedTiles = occupiedTiles.filter(function(tileId) {
			var index = tiles.indexOf(tileId);
			// make the disconnected user's tiles white again
			if (index > -1) {
				$('#' + tileId).css("background-color", "#FFF");
			}
			return index < 0;
		});
		showToast(user.name + ' left the game !');
	});

	$(document).on('mouseover', '.game-tile', function() {
		if (occupiedTiles.indexOf($(this).attr('id')) === -1) {
			$(this).css("background-color", color);
		}
	});

	$(document).on('mouseout', '.game-tile', function() {
		if (occupiedTiles.indexOf($(this).attr('id')) === -1) {
			$(this).css("background-color", "#FFF");
		}
	});

	$(document).on('click', '.game-tile', function() {
		var id = $(this).attr('id');

		// check if the tile is occupied already
		if (occupiedTiles.indexOf(id) > -1) {
			showToast('Tile already occupied !');
		} else {
			// keep track of occupied tiles
			occupiedTiles.push(id);
			$(this).css("background-color", color);
			socket.emit('tile click', { tileId: id });
		}
	});
});