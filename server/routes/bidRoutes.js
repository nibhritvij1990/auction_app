const express = require('express');
const router = express.Router();

const Auction = require('../models/Auction');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Bid = require('../models/Bid');
const authMiddleware = require('../middleware/authMiddleware'); 
const upload = require('../middleware/uploadConfig'); 

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const filter = { ...req.query };
      const bids = await Bid.find(filter);
      return res.json(bids);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:bidId', authMiddleware, async (req, res) => {
    try {
      const { bidId } = req.params;
      const bid = await Bid.findById(bidId);
      if (!bid) {
        return res.status(404).json({ error: 'Bid not found' });
      }
      return res.json(bid);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/all', authMiddleware, async (req, res) => {
    try {
      await Bid.deleteMany({});
      return res.json({ message: 'All bids have been deleted' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  
  module.exports = router;