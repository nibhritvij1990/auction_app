const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const authMiddleware = require('../middleware/authMiddleware'); 
const upload = require('../middleware/uploadConfig');

// GET all teams
router.get('/', authMiddleware, async (req, res) => {
  try {
    const teams = await Team.find();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:teamId', authMiddleware, async (req, res) => {
    try {
      const { teamId } = req.params;
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      return res.json(team);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

// CREATE a new team
router.post('/', authMiddleware, (req, res, next) => {
    // We manually invoke Multer to handle file upload errors
    upload.single('image_file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      // Destructure from req.body
      const { auction_id, team_name, purse, max_players, image_url } = req.body;
  
      // Decide final image path
      let finalImage = '';
      if (req.file) {
        // The user uploaded a file, so override any typed image URL
        finalImage = '/uploads/' + req.file.filename;
      } else if (image_url) {
        // No file was uploaded, but user typed a URL
        finalImage = image_url;
      }
  
      // Create the team doc
      const newTeam = new Team({
        auction_id,
        team_name,
        purse: purse || 2500,
        max_players: max_players || 15,
        image: finalImage
      });
  
      await newTeam.save();
      return res.status(201).json(newTeam);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.put('/:teamId', authMiddleware, (req, res, next) => {
    // We manually invoke Multer’s single-file middleware:
    upload.single('image_file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const { teamId } = req.params;
      const {
        team_name,
        purse,
        max_players,
        image_url
      } = req.body;
  
      // 1) Find existing team
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
  
      // 2) Handle image logic
      // Start with the old image in case we don't override
      let finalImage = team.image;
  
      if (req.file) {
        // File present => override any URL
        finalImage = '/uploads/' + req.file.filename;
      } else if (image_url) {
        finalImage = image_url;
      }
  
      // 3) Update fields only if provided
      if (team_name !== undefined) {
        team.team_name = team_name;
      }
      if (purse !== undefined && purse.trim() !== '') {
        team.purse = Number(purse);
      }
      if (max_players !== undefined && max_players.trim() !== '') {
        team.max_players = Number(max_players);
      }
  
      // Update image
      team.image = finalImage;
  
      // 4) Save changes
      await team.save();
      return res.json(team);
  
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

router.delete('/:teamId', authMiddleware, async (req, res) => {
    try {
      const { teamId } = req.params;
      const deletedTeam = await Team.findByIdAndDelete(teamId);
      if (!deletedTeam) {
        return res.status(404).json({ error: 'Team not found' });
      }
      return res.json({ message: 'Team deleted' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

module.exports = router;