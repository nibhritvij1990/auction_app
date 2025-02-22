require('dotenv').config();              // Loads environment variables from .env
const express = require('express');  
const http = require('http'); 
const { Server } = require('socket.io');    // Our web server framework
const mongoose = require('mongoose');    // Mongoose helps us talk to MongoDB
const cors = require('cors');           // Allows cross-origin requests if needed

const upload = require('./middleware/uploadConfig'); 
const multer = require('multer');
const path = require('path');

const { placeBidLogic } = require('./controllers/bidController');
const Auction = require('./models/Auction');
const Team = require('./models/Team');
const Player = require('./models/Player');
const Bid = require('./models/Bid');
// Create an Express app
const app = express();
// BEFORE any route definitions, add this middleware:
app.use((req, res, next) => {
    // "no-store" means the browser should not cache anything
    // you could also use "no-cache", depending on your needs
    res.set('Cache-Control', 'no-store');
    next();
  });

// Middleware
app.use(cors());                         // Enable CORS (helpful if front-end is separate)
app.use(express.json());                 // Support JSON request bodies

// Connect to MongoDB (Atlas) using the MONGO_URI from .env
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas!'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Basic test route (just returns a "Hello" message)
app.get('/', (req, res) => {
  res.send('Hello! Your auction server is running.');
});

const teamRoutes = require('./routes/teamRoutes');
const playerRoutes = require('./routes/playerRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const authRoutes = require('./routes/authRoutes');
const bidRoutes = require('./routes/bidRoutes');
const { notStrictEqual } = require('assert');

app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/bids', bidRoutes);
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: '*'
    }
  });
  
  let currentPlayer =  null;
  let currentSet = null;
  let lastSoldPlayer = null;

  io.on('connection', async(socket) => {
    const pageParam = socket.handshake?.query?.page; 
    console.log('A user connected', socket.id, 'on page', pageParam);
    // On connect, send the current player info
    if (pageParam && pageParam === 'ticker_lastSold') {
      io.emit('playerSold', lastSoldPlayer);
    } else {
      if (currentPlayer && currentPlayer._id) {
        const p = await Player.findById(currentPlayer._id);
        if (!p || p.status != 'available') {
          // The DB says it's sold or doesn't exist => reset
          currentPlayer = null;
          socket.emit('currentPlayerChanged', null);
        } else {
          // still valid, emit
          socket.emit('currentPlayerChanged', currentPlayer);
        }
      } else {
        socket.emit('currentPlayerChanged', null);
      }
    }

    socket.on('selectSet', async (aData) => {
        // If you have roles, check if (socket.role === 'admin'), etc.
        console.log('Admin selected set:', aData.setName);
        currentSet = aData.setName;

        let filters = {
          auction_id: aData.auctionId,
          status: { $in: ['available','Available'] }
        };
        if (currentSet !== 'All') {
          filters.auction_set = currentSet;
        }
        const unsoldPlayers = await Player.find(filters);
        // Optionally broadcast to others that the set changed
        io.emit('setChanged', { "setName": aData.setName, "players": unsoldPlayers });
      });


    socket.on('placeBid', async (data) => {
      try {
        const { auctionId, playerId, teamId } = data;
        const updatedPlayer = await placeBidLogic({ auctionId, playerId, teamId });
        // broadcast
        io.emit('bidUpdated', {
          playerId: updatedPlayer._id,
          final_bid: updatedPlayer.final_bid,
          teamId,
          auctionId
        });
      } catch (err) {
        console.error('Error placing bid:', err);
        socket.emit('errorMsg', { error: err.message });
      }
    });


    socket.on('markAllUnsoldAsAvailable', async (data) => {
      try {
        const { auctionId } = data;
        // Update all players with status='unsold' in that auction to 'available'
        const result = await Player.updateMany({
          auction_id: auctionId,
          status: 'unsold'
        }, {
          $set: { status: 'available' }
        });

        console.log(`Updated ${result.modifiedCount} players from unsold to available.`);
        // Then broadcast either a refresh event or success message
        io.emit('allUnsoldAsAvailableDone', { modifiedCount: result.modifiedCount });

      } catch (err) {
        console.error('Error in markAllUnsoldAsAvailable:', err);
        socket.emit('errorMsg', { error: err.message });
      }
    });

    // Next Player logic from before:
    socket.on('nextPlayer', async (auctionData) => {
      try {
          console.log('Received nextPlayer event from client:', socket.id);
        if (!currentSet) {
          socket.emit('errorMsg', 'No set is selected yet.');
          return;
        }
        let filters = {
          //auction_id: "677cd0286877dbfe9da743a6",
          auction_id: auctionData.auctionId,
          //auction_set: currentSet,
          //status: { $in: ['available', 'unsold'] },
          status: { $in: ['available'] }
        };
        if (currentSet !== 'All') {
          filters.auction_set = currentSet;
        }
        if (auctionData.playerId) {
          filters._id = auctionData.playerId;
        }

        const unsoldPlayers = await Player.find(filters);

        if (unsoldPlayers.length === 0) {
          io.emit('currentPlayerChanged', null); 
          return;
        }

        // pick a random one
        const randomIndex = Math.floor(Math.random() * unsoldPlayers.length);
        const chosenPlayer = unsoldPlayers[randomIndex];
        console.error('Chosen Player:', chosenPlayer);

        // Optionally mark them as "in_bidding" or something:
        // chosenPlayer.status = 'in_bidding';
        // await chosenPlayer.save();

        // store in memory for demonstration
        currentPlayer = {
          _id: chosenPlayer._id.toString(),
          full_name: chosenPlayer.full_name,
          final_bid: chosenPlayer.final_bid || 0,
          image: chosenPlayer.image || '',
          category: chosenPlayer.category || '',
          base_price: chosenPlayer.base_price || 0,
          notes: chosenPlayer.notes || '',
          matches: chosenPlayer.matches || '',
          runs: chosenPlayer.runs || '',
          avg: chosenPlayer.avg || '',
          sr: chosenPlayer.sr || '',
          overs: chosenPlayer.overs || '',
          wkts: chosenPlayer.wkts || '',
          econ: chosenPlayer.econ || '',
          ch_profile: chosenPlayer.ch_profile || '',
          bat_style: chosenPlayer.bat_style || 'N/A',
          bowl_style: chosenPlayer.bowl_style || 'N/A',
          auction_set: chosenPlayer.auction_set || '',
          current_set: currentSet,
          // etc.
        };

        // broadcast
        io.emit('currentPlayerChanged', currentPlayer);
      } catch (err) {
        console.error('Error in nextPlayer:', err);
        socket.emit('errorMsg', 'Server error picking next player.');
      }
    });

    // NEW: placeBid

    // etc. if you want undo logic:
    socket.on('undoBid', async (data) => {
      try {
        const { playerId } = data;
        // 1) find the last Bids doc
        const lastBid = await Bid.findOne({ player_id: playerId, undone: false }).sort({ createdAt: -1 });
        if (!lastBid) {
          throw new Error('No bids to undo for this player');
        }
    
        // 2) Mark undone or remove it
        await Bid.deleteOne({ _id: lastBid._id });
        // or lastBid.undone = true; await lastBid.save();
    
        // 3) find the next-latest
        const prevBid = await Bid.findOne({ player_id: playerId, undone: false }).sort({ createdAt: -1 });
    
        // 4) load the player
        const player = await Player.findById(playerId);
        if (!player) throw new Error('Player not found for undo');
    
        if (prevBid) {
          player.final_bid = prevBid.amount;
        } else {
          // no more active bids => revert to base_price
          //player.final_bid = player.base_price;
          player.final_bid = null;
        }
        await player.save();
    
        io.emit('bidUpdated', {
          playerId: player._id,
          final_bid: player.final_bid,
          teamId: prevBid ? prevBid.team_id : null,
          undone: true
        });
      } catch (err) {
        console.error('Error undoing bid:', err);
        socket.emit('errorMsg', { error: err.message });
      }
    });

    socket.on('markPlayerSold', async (data) => {
      try {
        const { playerId, teamId } = data;
        // Load Player, Team
        const player = await Player.findById(playerId);
        const team = await Team.findById(teamId);
        if(!player || !team) throw new Error('Player or Team not found');
    
        // For leftover logic, we assume final_bid is already in player.final_bid
        // Deduct from team purse
        if (player.final_bid > team.purse) {
          throw new Error('Team cannot afford final_bid, something is off');
        }
        team.purse -= player.final_bid;
        team.current_players += 1;
        await team.save();
    
        // Mark the player as sold
        player.status = 'sold';
        player.sold_to_team_id = teamId;
        player.auctionedAt = (new Date()).toISOString();
        await player.save();
    
        // Broadcast to all that player is sold
        lastSoldPlayer = { 
          playerId: player._id, 
          final_bid: player.final_bid, 
          sold_to: team._id, 
          sold_to_team_id: team._id 
        };
        io.emit('playerSold', lastSoldPlayer);
      } catch(err) {
          console.error('Error marking player sold:', err);
          socket.emit('errorMsg', { error: err.message });
        }
    });

      socket.on('markPlayerUnsold', async (data) => {
          try {
            const { playerId } = data;
            const player = await Player.findById(playerId);
            if (!player) throw new Error('Player not found');
        
            // revert final_bid to base_price
            player.final_bid = 0;
            player.status = 'unsold'; // or "available" if you prefer
            player.auctionedAt = (new Date()).toISOString();
            await player.save();
        
            // Possibly remove any Bids for that player or keep them for reference
            await Bid.deleteMany({ player_id: playerId });
        
            io.emit('playerUnsold', { 
              playerId: player._id,
              final_bid: 0
            });
        
          } catch (err) {
            console.error('Error marking unsold:', err);
            socket.emit('errorMsg', { error: err.message });
          }
        });


    socket.on('disconnect', () => {
      console.log('User disconnected', socket.id);
    });
  });
  
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });