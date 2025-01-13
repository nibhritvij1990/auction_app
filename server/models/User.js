const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin','team_owner','player','guest'],
    required: true // or you can have different roles if needed
  },
  team_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Team', 
    default: null 
  }
});

module.exports = mongoose.model('User', UserSchema);