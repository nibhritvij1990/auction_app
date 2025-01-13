const mongoose = require('mongoose');

// optional sub-schema for increments or custom rules
const IncrementRuleSchema = new mongoose.Schema({
  threshold: Number,  // e.g. 150, 350
  amount: Number      // e.g. 10, 20
}, { _id: true }); // ensures each increment has its own _id field

const AuctionSchema = new mongoose.Schema({
  name: { type: String, required: true },      // "IPL 2023 Auction", etc.
  date: { type: Date, default: Date.now },     // or any scheduling time
  status: { type: String, default: 'upcoming' }, // or 'ongoing', 'completed', etc.
  image_url: { type: String, default: './images/logo-auction-default.png' },
  base_price: { type: Number, default: 20 },

  // If you want an array of increments
  increments: [IncrementRuleSchema],

  // references to multiple Teams (you can store objectIds or embed them)
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],

  // references to multiple Players
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],

  // or other rules (maxPlayersPerTeam, baseBudget, etc.)
  max_players_per_team: { type: Number, default: 15 },
  base_budget: { type: Number, default: 2500 },

  // anything else you want to configure specifically for each auction
});

module.exports = mongoose.model('Auction', AuctionSchema);