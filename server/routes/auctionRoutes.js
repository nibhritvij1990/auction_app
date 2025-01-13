const express = require('express');
const router = express.Router();

const Auction = require('../models/Auction');
const Team = require('../models/Team');
const Player = require('../models/Player');
const authMiddleware = require('../middleware/authMiddleware'); 
const upload = require('../middleware/uploadConfig'); 

router.post('/', authMiddleware, (req, res, next) => {
    upload.single('logo_file')(req, res, function (err) {
        if (err) {
            // Multer error (file filter or size limit)
            return res.status(400).json({ error: err.message });
        }
        // if no error, proceed
        next();
    });
}, async (req, res) => {
    try {
        /*
          The 'upload.single("logo_file")' middleware processes the file input named "logo_file".
          - If the user attached a file, you can access it at req.file
          - The text fields come in req.body
        */
        const {
            name,
            logo_url,
            date,
            max_players_per_team,
            base_budget,
            base_price
        } = req.body;

        // Decide which logo to store:
        let finalLogo = logo_url; // If the user typed a URL
        if (req.file) {
            // They uploaded a file, so override the finalLogo with the path /public/uploads/filename
            finalLogo = '/uploads/' + req.file.filename; 
            // If you want full URL: e.g. finalLogo = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
        }

        // Create new Auction doc
        const newAuction = new Auction({
            name,
            image_url: finalLogo,
            date,
            max_players_per_team,
            base_budget,
            base_price
            // any additional fields
        });
        await newAuction.save();
        return res.status(201).json(newAuction);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const auctions = await Auction.find();
      return res.json(auctions);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:auctionId', authMiddleware, async (req, res) => {
    try {
      const { auctionId } = req.params;
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
      return res.json(auction);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  
    router.put('/:auctionId', authMiddleware, (req, res, next) => {
    upload.single('logo_file')(req, res, function (err) {
        if (err) {
            // Multer error (file filter or size limit)
            return res.status(400).json({ error: err.message });
        }
        // if no error, proceed
        next();
    });
    }, async (req, res) => {
        try {
            const { auctionId } = req.params;
            const {
                name,
                logo_url,
                date,
                max_players_per_team,
                base_budget,
                base_price
            } = req.body;

            let finalLogo = logo_url;
            if (req.file) {
                finalLogo = '/uploads/' + req.file.filename;
            }

            const updated = await Auction.findByIdAndUpdate(
                auctionId,
                {
                    name,
                    image_url: finalLogo,
                    date,
                    max_players_per_team,
                    base_budget,
                    base_price
                },
                { new: true }
            );
            if (!updated) {
                return res.status(404).json({ error: 'Auction not found' });
            }
            return res.json(updated);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });

  
    router.post('/:auctionId/bid', authMiddleware, async (req, res) => {
        try {
          const { auctionId } = req.params;
          const { playerId, teamId } = req.body;
      
          // 1) Load Auction
          const auction = await Auction.findById(auctionId);
          if (!auction) {
            return res.status(404).json({ error: 'Auction not found' });
          }
      
          // 2) Fetch Player & Team
          const player = await Player.findById(playerId);
          const team = await Team.findById(teamId);
      
          if (!player || !team) {
            return res.status(404).json({ error: 'Player or Team not found' });
          }
      
          // 3) Confirm both belong to same auction
          if (player.auction_id.toString() !== auctionId || team.auction_id.toString() !== auctionId) {
            return res.status(400).json({ error: 'Player/Team mismatch with Auction' });
          }
      
          // 4) Player not already sold
          if (player.status === 'sold') {
            return res.status(400).json({ error: 'This player is already sold' });
          }
      
          // 5) Calculate next bid
          let currentBid = player.final_bid <= 0 ? player.base_price : player.final_bid;
      
          // sort & figure out increment from Auction.increments
          const sortedIncrements = (auction.increments || []).sort((a, b) => a.threshold - b.threshold);
          let increment = 0;
          for (const rule of sortedIncrements) {
            if (currentBid < rule.threshold) {
              increment = rule.amount;
              break;
            }
          }
          // if no rule matched, use the last increment
          if (increment === 0 && sortedIncrements.length > 0) {
            increment = sortedIncrements[sortedIncrements.length - 1].amount;
          }
          const newBid = currentBid + increment;
      
          // 6) Check budget logic
          //    "One more player now" => (max_players - current_players - 1) remaining after this buy
          const remainingPlayers = team.max_players - team.current_players - 1;
          if (remainingPlayers < 0) {
            return res.status(400).json({ error: 'Team already has enough players. Cannot bid.' });
          }
      
          // base_price from the Auction is the minimum cost for each future player
          const minCostForRemaining = remainingPlayers * auction.base_price;
      
          // So after paying newBid, the team must have at least minCostForRemaining left
          if (newBid + minCostForRemaining > team.purse) {
            return res.status(400).json({
              error: 'Insufficient purse. Must leave enough for remaining roster minimum.'
            });
          }
      
          // If we pass that check, newBid is valid
          player.final_bid = newBid;
          await player.save();
      
          // Optionally track last bidder, etc.
      
          return res.json({
            message: 'Bid placed successfully',
            final_bid: player.final_bid
          });
        } catch (error) {
          return res.status(500).json({ error: error.message });
        }
      });

  /*
   This finalizes the player’s sale at their current final_bid, 
   deducts from the team’s purse, increments team’s current_players, etc.
*/
router.post('/:auctionId/sold', authMiddleware, async (req, res) => {
    try {
      const { auctionId } = req.params;
      const { playerId, teamId } = req.body;
  
      // 1) Validate the Auction
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
  
      // 2) Fetch Player & Team
      const player = await Player.findById(playerId);
      const team = await Team.findById(teamId);
      if (!player || !team) {
        return res.status(404).json({ error: 'Player or Team not found' });
      }
  
      // 3) Ensure they belong to the same auction
      if (player.auction_id.toString() !== auctionId || team.auction_id.toString() !== auctionId) {
        return res.status(400).json({ error: 'Player/Team mismatch with Auction' });
      }
  
      // 4) Check if player is already sold
      if (player.status === 'sold') {
        return res.status(400).json({ error: 'Player is already sold' });
      }
  
      // 5) If no bid was placed, final_bid might still be base_price 
      //    You can decide whether that’s allowed or not.
      const finalBid = player.final_bid > 0 ? player.final_bid : player.base_price;
  
      // 6) Check the team’s purse again
      if (finalBid > team.purse) {
        return res.status(400).json({ error: 'Team cannot afford this final bid' });
      }
  
      // 7) Deduct from team’s purse, increment current_players
      team.purse -= finalBid;
      team.current_players += 1;
      await team.save();
  
      // 8) Mark the player as sold, store sold_to_team_id
      player.status = 'sold';
      player.sold_to_team_id = team._id;
      await player.save();
  
      return res.json({
        message: 'Player sold successfully',
        player,
        team
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  /*
   This reverts a player to "unsold" if no valid bids were placed.
   Or if you have a rule that if final_bid == base_price, you treat them as unsold,
   you can reset final_bid to 0 or base_price if you want to bring them back later.
*/
router.post('/:auctionId/unsold', authMiddleware, async (req, res) => {
    try {
      const { auctionId } = req.params;
      const { playerId } = req.body;
  
      // 1) Validate Auction
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
  
      // 2) Fetch Player
      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
  
      // 3) Check Auction match
      if (player.auction_id.toString() !== auctionId) {
        return res.status(400).json({ error: 'Player mismatch with Auction' });
      }
  
      // 4) If they have a final_bid above base_price, you might block unsold
      if (player.final_bid > player.base_price) {
        return res.status(400).json({ error: 'At least one valid bid placed, cannot mark unsold' });
      }
  
      // 5) Mark them unsold
      player.status = 'unsold';
      // optionally reset final_bid to base_price or 0
      player.final_bid = player.base_price;
      await player.save();
  
      return res.json({
        message: 'Player marked unsold',
        player
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:auctionId/summary', authMiddleware, async (req, res) => {
    try {
      const { auctionId } = req.params;
  
      // 1) Make sure the auction exists
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
  
      // 2) Fetch all teams for this auction
      const teams = await Team.find({ auction_id: auctionId });
  
      // 3) Fetch all players for this auction
      //    We'll populate “sold_to_team_id” so we can see the team object 
      //    (or at least the team's name)
      const players = await Player.find({ auction_id: auctionId })
                                  .populate('sold_to_team_id', 'team_name');
  
      // 4) Build a summary object
      //    For example, gather an array of sold players, unsold players, etc.
  
      // Sold players
      const soldPlayers = players.filter(p => p.status === 'sold').map(p => ({
        id: p._id,
        name: p.full_name,
        category: p.category,
        final_bid: p.final_bid,
        sold_to_team: p.sold_to_team_id ? p.sold_to_team_id.team_name : null
      }));
  
      // Unsold players
      const unsoldPlayers = players.filter(p => p.status === 'unsold').map(p => ({
        id: p._id,
        name: p.full_name,
        category: p.category,
        base_price: p.base_price
      }));
  
      // Available (never bid on, or not yet sold)
      const availablePlayers = players.filter(p => p.status === 'available').map(p => ({
        id: p._id,
        name: p.full_name,
        category: p.category,
        final_bid: p.final_bid
      }));
  
      // Team finances: how much each team spent, how many players they got
      // We can derive “spent” from the difference in their initial purse minus current purse.
      // or sum up final_bid of their players. I’ll do it by team doc’s fields:
      const teamSummaries = teams.map(t => {
        const teamSoldPlayers = players.filter(p => p.sold_to_team_id && p.sold_to_team_id._id.toString() === t._id.toString());
        const totalSpent = teamSoldPlayers.reduce((acc, p) => acc + p.final_bid, 0);
        return {
          team_id: t._id,
          team_name: t.team_name,
          current_purse: t.purse,
          total_spent: totalSpent,
          current_players: t.current_players,
          max_players: t.max_players
        };
      });
  
      // 5) Construct final summary response
      const summary = {
        auction: {
          id: auction._id,
          name: auction.name,
          status: auction.status
        },
        teamSummaries,
        soldPlayers,
        unsoldPlayers,
        availablePlayers
      };
  
      return res.json(summary);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:auctionId', authMiddleware, async (req, res) => {
    try {
      const { auctionId } = req.params;
      const deletedAuction = await Auction.findByIdAndDelete(auctionId);
      if (!deletedAuction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
  
      // Optionally, also delete associated teams & players 
      // if you really want to remove them from the DB:
      await Team.deleteMany({ auction_id: auctionId });
      await Player.deleteMany({ auction_id: auctionId });
  
      return res.json({ message: 'Auction and associated data deleted' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  
  router.post('/:auctionId/increments', authMiddleware, async (req, res) => {
    try {
      const { auctionId } = req.params;
      const { threshold, amount } = req.body;
  
      // Validate input
      if (typeof threshold !== 'number' || typeof amount !== 'number') {
        return res.status(400).json({ error: 'threshold and amount should be numbers' });
      }
  
      // Find the auction
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
  
      // Push the new increment
      auction.increments.push({ threshold, amount });
  
      // Save
      await auction.save();
  
      // Return updated increments or entire auction, your choice
      return res.json({ increments: auction.increments });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/:auctionId/increments/:incId', authMiddleware, async (req, res) => {
    try {
      const { auctionId, incId } = req.params;
      const { threshold, amount } = req.body; // user might pass { threshold: 200, amount: 15 }
  
      // 1) Find the Auction
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
  
      // 2) Find the specific increment subdocument by incId
      const increment = auction.increments.id(incId);
      if (!increment) {
        return res.status(404).json({ error: 'Increment rule not found' });
      }
  
      // 3) Update fields if provided
      if (threshold !== undefined) increment.threshold = Number(threshold);
      if (amount !== undefined) increment.amount = Number(amount);
  
      // 4) Save
      await auction.save();
  
      // 5) Return updated increments (or entire auction, your choice)
      return res.json({ increments: auction.increments });
  
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:auctionId/increments/:incId', authMiddleware, async (req, res) => {
    try {
      const { auctionId, incId } = req.params;
  
      // 1) Find Auction
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Auction not found' });
      }
  
      // 2) Locate increment subdoc
      const increment = auction.increments.id(incId);
      if (!increment) {
        return res.status(404).json({ error: 'Increment rule not found' });
      }
  
      // 3) Remove it from the array
      increment.remove();  
  
      // or you can do:
      // auction.increments.pull({ _id: incId });
  
      // 4) Save
      await auction.save();
  
      // 5) Return updated increments
      return res.json({ increments: auction.increments });
  
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  
  module.exports = router;