const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// For signing JWT, we need a secret key. Typically read from .env
const JWT_SECRET = process.env.JWT_SECRET || 'someSecretKey';


router.get('/users', async (req, res) => {
    try {
      const users = await User.find({}, '-password'); // Exclude the password field
      return res.status(200).json(users);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
/**
 * POST /api/auth/register
 * Body: { username, password }
 * This route is optional if you want to manually create users. 
 * Or you might do it once for an admin, then remove it.
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password , role , team_id } = req.body;

    // Check if user already exists
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user doc
    const newUser = new User({
      username,
      password: hashedPassword,
      role,
      team_id
    });
    await newUser.save();

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 *
 * On success, returns a JWT token.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1) Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 2) Compare password with hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 3) Create a JWT
    // We'll embed { id: user._id, role: user.role } in the token
    const tokenPayload = {
      id: user._id,
      role: user.role,
      teamId: user.team_id 
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '96h' });

    // 4) Send token back
    return res.json({ 
      message: 'Login successful',
      token,
      tokenPayload 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deletedUser = await User.findByIdAndDelete(id);
  
      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role, team_id } = req.body;
  
      // If password is provided, hash it
      let updateData = { username, role, team_id };
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateData.password = hashedPassword;
      }
  
      const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });
  
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      return res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

module.exports = router;