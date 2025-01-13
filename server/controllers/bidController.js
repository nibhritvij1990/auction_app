const Player = require('../models/Player');
const Team = require('../models/Team');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');

async function placeBidLogic({ auctionId, playerId, teamId }) {
    // 1) load Auction, Player, Team
    const auction = await Auction.findById(auctionId);
    if (!auction) throw new Error(`Auction not found: ${auctionId}`);
  
    const player = await Player.findById(playerId);
    if (!player) throw new Error(`Player not found: ${playerId}`);
  
    const team = await Team.findById(teamId);
    if (!team) throw new Error(`Team not found: ${teamId}`);
  
    // 2) check Auction mismatch
    if (player.auction_id.toString() !== auctionId || team.auction_id.toString() !== auctionId) {
      throw new Error('Player/Team mismatch with Auction');
    }
  
    // 3) if player.status === 'sold', throw ...
  
    // 4) figure out increment from Auction doc
    //let currentBid = (player.final_bid <= 0) ? player.base_price : player.final_bid;
    let currentBid = player.final_bid;
    const sortedIncrements = (auction.increments || []).sort((a, b) => a.threshold - b.threshold);
  
    let chosenIncrement = 0;
    if (currentBid == 0 || currentBid == null || currentBid == undefined || currentBid == '' || !currentBid ) {
      chosenIncrement = player.base_price;
    } else {
        for (const rule of sortedIncrements) {
        if (currentBid < rule.threshold) {
            chosenIncrement = rule.amount;
            break;
        }
        }
        if (chosenIncrement === 0 && sortedIncrements.length > 0) {
            chosenIncrement = sortedIncrements[sortedIncrements.length - 1].amount;
      }
    }
  
    let newBid = currentBid + chosenIncrement;
  
    // 5) leftover check
    const remainingPlayers = team.max_players - team.current_players - 1;
    if (remainingPlayers < 0) throw new Error('Team is already full');
    const minCostForRemaining = remainingPlayers * auction.base_price;
    if (newBid + minCostForRemaining > team.purse) {
      throw new Error('Insufficient purse once leftover logic is considered.');
    }
  
    // 6) update final_bid in DB
    player.final_bid = newBid;
    await player.save();
  
    // 7) record a Bids doc
    await Bid.create({
      player_id: player._id,
      team_id: team._id,
      amount: newBid,
    });
  
    return player;
  }
  
  module.exports = { placeBidLogic };