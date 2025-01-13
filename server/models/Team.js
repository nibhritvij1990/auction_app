const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    auction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
    team_name: { type: String, required: true, unique: true },
  purse: { type: Number, default: 2500 },       // budget or purse
  image: { type: String, default: './images/logo-team-default.jpg' },
  max_players: { type: Number, default: 15 },
  current_players: { type: Number, default: 0 },
  // You can add more fields as needed.
});

module.exports = mongoose.model('Team', TeamSchema);