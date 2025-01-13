const mongoose = require('mongoose');

const BidSchema = new mongoose.Schema({
  player_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  undone: { type: Boolean, default: false },
});

module.exports = mongoose.model('Bid', BidSchema);
