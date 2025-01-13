const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  // Basic info
  full_name: { type: String, required: true },
  image: { type: String, default: './images/logo-player-default.jpg' },
  category: { type: String, default: '' },  // e.g. "Batsman", "Bowler", etc.
  base_price: { type: Number, default: 20 },
  auction_set: { type: String, default: 'Default Set' },

  // Additional details
  auction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  ch_profile: { type: String, default: '' }, // If you have a CricInfo or other profile link
  email: { type: String, default: '' },
  phone_number: { type: String, default: '' },
  matches: { type: Number, default: 0 },
  runs: { type: Number, default: 0 },
  avg: { type: Number, default: 0 },
  sr: { type: Number, default: 0 }, // strike rate
  overs: { type: Number, default: 0 },
  wkts: { type: Number, default: 0 },
  econ: { type: Number, default: 0 }, // economy rate
  notes: { type: String, default: '' },

  // Auction-related logic
  status: { type: String, default: 'available' }, // or 'sold', 'unsold'
  final_bid: { type: Number, default: 0 },
  sold_to_team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
});

module.exports = mongoose.model('Player', PlayerSchema);