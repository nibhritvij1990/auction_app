const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const Auction = require('../models/Auction');
const Team = require('../models/Team');
const Bid = require('../models/Bid');
const authMiddleware = require('../middleware/authMiddleware'); 
const upload = require('../middleware/uploadConfig');
const mongoose = require('mongoose');

// GET all players
/*router.get('/', authMiddleware, async (req, res) => {
  try {
    const players = await Player.find();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); */

router.get('/', authMiddleware, async (req, res) => {
    try {
      // Simply clone all query params as our filter
      // (in typical usage, you may want to validate or sanitize these properties, especially if they're numeric)
      const filter = { ...req.query };
  
      // Fetch players using the filter
      const players = await Player.find(filter);
      res.json(players);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

router.get('/:playerId', authMiddleware, async (req, res) => {
    try {
      const { playerId } = req.params;
      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      return res.json(player);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

// CREATE a player
router.post('/', authMiddleware, (req, res, next) => {
    upload.single('image_file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const { auction_id, full_name, category, base_price, image_url, image_file, auction_set } = req.body;
  
      // Decide final image
      let finalImage = '';
      if (req.file) {
        finalImage = '/uploads/' + req.file.filename;
      } else if (image_url) {
        finalImage = image_url;
      }

      let finalBasePrice = Number(base_price); // if base_price is blank, this is NaN
      if (!finalBasePrice) {
        // base_price is blank or "0" – fetch from Auction
        const foundAuction = await Auction.findById(auction_id);
        if (foundAuction && foundAuction.base_price) {
          finalBasePrice = foundAuction.base_price;
        } else {
          // fallback
          finalBasePrice = null; 
        }
      }
  
      const newPlayer = new Player({
        auction_id,
        full_name,
        category,
        base_price: finalBasePrice, 
        image: finalImage,
        auction_set: auction_set,
        // etc.
      });
  
      await newPlayer.save();
      return res.status(201).json(newPlayer);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.put('/bulk-update', authMiddleware, async (req, res) => {
    try {
      // Expect an array of updates, each with _id plus fields to change
      // e.g. [ { "_id": "...", "base_price": 80, "auction_set":"SetB" }, ...]
      const updatesArray = req.body;

      const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
      for (const update of updatesArray) {
        if (!isValidObjectId(update._id)) {
          return res.status(400).json({ error: `Invalid ObjectId: ${update._id}` });
        }
        update._id = new mongoose.Types.ObjectId(update._id);
        if (update.sold_to_team_id === "") {  
          update.sold_to_team_id = null;  
        }
      }
  
      // Build bulkWrite operations
      const ops = updatesArray.map(u => {
        const { _id, ...rest } = u;
        return {
          updateOne: {
            filter: { _id },
            update: { $set: { ...rest } }
          }
        };
      });
  
      if (!ops.length) {
        return res.json({ updatedCount: 0, message: 'No updates provided' });
      }
  
      const result = await Player.bulkWrite(ops);
      return res.json({
        updatedCount: result.modifiedCount,
        message: `Updated ${result.modifiedCount} players`
      });
    } catch (err) {
      console.error('Bulk update error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

router.delete('/:playerId', authMiddleware, async (req, res) => {
    try {
      const { playerId } = req.params;
      const deletedPlayer = await Player.findByIdAndDelete(playerId);
      if (!deletedPlayer) {
        return res.status(404).json({ error: 'Player not found' });
      }
      return res.json({ message: 'Player deleted' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/distinct-sets/:auctionId', async (req, res) => {
    try {
      const { auctionId } = req.params;
      // Query the players for that auction, get distinct sets
      const sets = await Player.distinct('auction_set', { auction_id: auctionId });
      // `sets` is an array of strings, e.g. ["Set A", "Set B", ...]
      return res.json(sets);
    } catch (err) {
      console.error('Error fetching distinct sets:', err);
      return res.status(500).json({ error: 'Failed to get sets' });
    }
  });

  router.put('/mark-all-unsold-available/:auctionId', async (req, res) => {
    try {
      const { auctionId } = req.params;
      const result = await Player.updateMany({ auction_id: auctionId, status:'unsold' },
        { $set: { status: 'available' } });
      return res.json({ modifiedCount: result.modifiedCount });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:auctionId/all', async (req, res) => {
    try {
      const { auctionId } = req.params;
      // Remove all players with this auctionId
      const result = await Player.deleteMany({ auction_id: auctionId });
      console.log(`Deleted ${result.deletedCount} players for auction ${auctionId}`);
  
      return res.json({
        deletedCount: result.deletedCount,
        message: `Deleted all players for auction ${auctionId}`
      });
    } catch (err) {
      console.error('Error deleting all players:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/bulk-create', async (req, res) => {
    try {
      // Expect an array of player objects in the request body
      // Example doc: { full_name, base_price, auction_id, auction_set, ... }
      const playersArray = req.body; // e.g. [ { ... }, { ... } ]
  
      // Insert them in one go
      const insertedDocs = await Player.insertMany(playersArray);
      return res.json({
        insertedCount: insertedDocs.length,
        message: `Inserted ${insertedDocs.length} players successfully`
      });
    } catch (err) {
      console.error('Bulk create error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/:playerId/last-bid', async (req, res) => {
    try {
      const { playerId } = req.params;
      // Find the most recent bid for this player
      const lastBid = await Bid.findOne({ player_id: playerId }).sort({ createdAt: -1 }); 
      if (!lastBid) {
        return res.status(404).json({ message: 'No bids found for this player' });
      }
      return res.json(lastBid);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error fetching last bid' });
    }
  });

  router.put('/:playerId', authMiddleware, (req, res, next) => {
    // Manually invoke Multer for single file
    upload.single('image_file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const { playerId } = req.params;
      const { full_name, category, base_price, image_url, image_file, auction_set } = req.body;
  
      // 1) Find existing player
      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
  
      // 2) Decide finalImage
      // start with the player’s existing image in case we don’t override it
      let finalImage = player.image;
  
      if (req.file) {
        // user uploaded a new file -> override any URL
        finalImage = '/uploads/' + req.file.filename;
      } else if (image_url) {
        // user typed an image URL but no file -> override existing
        finalImage = image_url;
      }
      // if neither file nor image_url given, we keep the existing image
  
      // 3) Update fields if they’re provided. For example, if user leaves full_name blank, keep old
      //    Or you can choose to forcibly replace with blank. This is your design choice.
      if (full_name !== undefined) {
        player.full_name = full_name;
      }
      if (category !== undefined) {
        player.category = category;
      }
      if (base_price !== undefined && base_price.trim() !== '') {
        // If you want to allow re-fetch from Auction if base_price is blank, you can do it here
        player.base_price = Number(base_price);
      }
      player.image = finalImage;

      player.auction_set = auction_set;
  
      // 4) Save
      await player.save();
      return res.json(player);
  
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

module.exports = router;