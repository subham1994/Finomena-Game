##Finomenal Board Game##

**How to run locally**

 - You must have node.js installed (version used in project v7.2.0)
 - clone this repo or download the zip
 -  migrate to project root and run *'npm install'*
 -  run *'npm start'*
 -  open *'localhost:3000'* in your browser

**Features**

 - On the home page players can start a new game or join the current game
 - Each player is assigned a random color, when he/she joins the game
 - The first player is asked to configure the game (*advantage of arriving first*)
 - A board of configured dimension will be shown to all the players
 - A game automatically starts when at least 2 players join it
 - Each player can hover over the board and squares will light up with
 their assigned color
 - A player can acquire the square by clicking it and get 1 point
 - Once a square is acquired it gets filled with the player's color
 - An acquired square cannot be taken by any other player and its color will not change on hovering
 - Once a square is selected by a player, all players are blocked for x seconds to do anything (*x is a configurable value*)
 - After x seconds, board becomes available again for all the players

**Aditional Features**

 - There are two tiles with hidden +3 points in it, apart from the usual +1 point
 -  If a user leaves in the middle of the game, all it's acquired tiles are made available to be acquired by other players
 - If only one player is left in the game, the pauses again waiting for someone to join in


