function Player(playerName, chips, table) {
    this.playerName = playerName;
    this.chips = chips;
    this.folded = false;
    this.allIn = false;
    this.talked = false;
    this.table = table; //Circular reference to allow reference back to parent object.
    this.cards = [];
}


Player.prototype.GetChips = function(cash) {
    this.chips += cash;
};

// Player actions: Check(), Fold(), Bet(bet), Call(), AllIn()
Player.prototype.Check = function() {
    var checkAllow, v, i;
    checkAllow = true;
    for (v = 0; v < this.table.game.bets.length; v += 1) {
        if (this.table.game.bets[v] !== 0) {
            checkAllow = false;
        }
    }
    if (checkAllow) {
        for (i = 0; i < this.table.players.length; i += 1) {
            if (this === this.table.players[i]) {
                this.table.game.bets[i] = 0;
                this.talked = true;
            }
        }
        //Attemp to progress the game
        this.turnBet = {action: "check", playerName: this.playerName}
        progress(this.table);
    } else {
        //console.log("Check not allowed, replay please");
    }
};

Player.prototype.Fold = function() {
    var i, bet;
    //Move any current bet into the pot
    for (i = 0; i < this.table.players.length; i += 1) {
        if (this === this.table.players[i]) {
            bet = parseInt(this.table.game.bets[i], 10);
            this.table.game.bets[i] = 0;
            this.table.game.pot += bet;
            this.talked = true;
        }
    }
    //Mark the player as folded
    this.folded = true;
    this.turnBet = {action: "fold", playerName: this.playerName}

    //Attemp to progress the game
    progress(this.table);
};

Player.prototype.Bet = function(bet) {
    var i;
    if (this.chips > bet) {
        for (i = 0; i < this.table.players.length; i += 1) {
            if (this === this.table.players[i]) {
                this.table.game.bets[i] += bet;
                this.table.players[i].chips -= bet;
                this.talked = true;
            }
        }

        //Attemp to progress the game
        this.turnBet = {action: "bet", playerName: this.playerName, amount: bet}
        progress(this.table);
    } else {
        //console.log('You don\'t have enought chips --> ALL IN !!!');
        this.AllIn();
    }
};

function getMaxBet(bets) {
    var maxBet, i;
    maxBet = 0;
    for (i = 0; i < bets.length; i += 1) {
        if (bets[i] > maxBet) {
            maxBet = bets[i];
        }
    }
    return maxBet;
}


function checkForEndOfRound(table) {
    var maxBet, i, endOfRound;
    endOfRound = true;
    maxBet = getMaxBet(table.game.bets);
    //For each player, check
    for (i = 0; i < table.players.length; i += 1) {
        if (table.players[i].folded === false) {
            if (table.players[i].talked === false || table.game.bets[i] !== maxBet) {
                if (table.players[i].allIn === false) {
                  table.currentPlayer = i;
                  endOfRound = false;
                }
            }
        }
    }
    return endOfRound;
}

function progress(table) {
    table.eventEmitter.emit( "turn" );
    var i, j, cards, hand;
    if (table.game) {
        if (checkForEndOfRound(table) === true) {
          table.currentPlayer = (table.currentPlayer >= table.players.length-1) ? (table.currentPlayer-table.players.length+1) : (table.currentPlayer + 1 );
            //Move all bets to the pot
            for (i = 0; i < table.game.bets.length; i += 1) {
                table.game.pot += parseInt(table.game.bets[i], 10);
                table.game.roundBets[i] += parseInt(table.game.bets[i], 10);
            }
            if (table.game.roundName === 'River') {
                table.game.roundName = 'Showdown';
                table.game.bets.splice(0, table.game.bets.length);
                //Evaluate each hand
                for (j = 0; j < table.players.length; j += 1) {
                    cards = table.players[j].cards.concat(table.game.board);
                    hand = new Hand(cards);
                    table.players[j].hand = rankHand(hand);
                }
                checkForWinner(table);
                checkForBankrupt(table);
                table.eventEmitter.emit( "gameOver" );
            } else if (table.game.roundName === 'Turn') {
                //console.log('effective turn');
                table.game.roundName = 'River';
                table.game.deck.pop(); //Burn a card
                table.game.board.push(table.game.deck.pop()); //Turn a card
                //table.game.bets.splice(0,table.game.bets.length-1);
                for (i = 0; i < table.game.bets.length; i += 1) {
                    table.game.bets[i] = 0;
                }
                for (i = 0; i < table.players.length; i += 1) {
                    table.players[i].talked = false;
                }
                table.eventEmitter.emit( "deal" );
            } else if (table.game.roundName === 'Flop') {
                //console.log('effective flop');
                table.game.roundName = 'Turn';
                table.game.deck.pop(); //Burn a card
                table.game.board.push(table.game.deck.pop()); //Turn a card
                for (i = 0; i < table.game.bets.length; i += 1) {
                    table.game.bets[i] = 0;
                }
                for (i = 0; i < table.players.length; i += 1) {
                    table.players[i].talked = false;
                }
                table.eventEmitter.emit( "deal" );
            } else if (table.game.roundName === 'Deal') {
                //console.log('effective deal');
                table.game.roundName = 'Flop';
                table.game.deck.pop(); //Burn a card
                for (i = 0; i < 3; i += 1) { //Turn three cards
                    table.game.board.push(table.game.deck.pop());
                }
                //table.game.bets.splice(0,table.game.bets.length-1);
                for (i = 0; i < table.game.bets.length; i += 1) {
                    table.game.bets[i] = 0;
                }
                for (i = 0; i < table.players.length; i += 1) {
                    table.players[i].talked = false;
                }
                table.eventEmitter.emit( "deal" );
            }
        }
    }
}

Player.prototype.Call = function() {
    var maxBet, i;
    maxBet = getMaxBet(this.table.game.bets);
    if (this.chips > maxBet) {
        //Match the highest bet
        for (i = 0; i < this.table.players.length; i += 1) {
            if (this === this.table.players[i]) {
                if (this.table.game.bets[i] >= 0) {
                    this.chips += this.table.game.bets[i];
                }
                this.chips -= maxBet;
                this.table.game.bets[i] = maxBet;
                this.talked = true;
            }
        }
        //Attemp to progress the game
        this.turnBet = {action: "call", playerName: this.playerName, amount: maxBet}
        progress(this.table);
    } else {
        //console.log('You don\'t have enought chips --> ALL IN !!!');
        this.AllIn();
    }
};

Player.prototype.AllIn = function() {
    var i, allInValue=0;
    for (i = 0; i < this.table.players.length; i += 1) {
        if (this === this.table.players[i]) {
            if (this.table.players[i].chips !== 0) {
              allInValue = this.table.players[i].chips;
                this.table.game.bets[i] += this.table.players[i].chips;
                this.table.players[i].chips = 0;

                this.allIn = true;
                this.talked = true;
            }
        }
    }

    //Attemp to progress the game
    this.turnBet = {action: "allin", playerName: this.playerName, amount: allInValue}
    progress(this.table);
};

module.exports = Player;