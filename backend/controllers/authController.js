const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// Helper function to format user response
const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  authProvider: user.authProvider,
  themePreference: user.themePreference
});

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      authProvider: 'local'
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is OAuth user trying to login with password
    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({ 
        message: 'Please sign in with Google',
        authProvider: 'google'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists with Google ID
    let user = await User.findOne({ googleId });

    if (user) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Check if user exists with same email (link accounts)
      user = await User.findOne({ email });

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        user.avatar = picture || user.avatar;
        user.authProvider = 'google';
        user.lastLogin = new Date();
        await user.save();
      } else {
        // Create new user
        user = new User({
          googleId,
          name,
          email,
          avatar: picture,
          authProvider: 'google',
          lastLogin: new Date()
        });
        await user.save();
      }
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(400).json({ message: 'Invalid Google token' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(formatUserResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, themePreference } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (themePreference) user.themePreference = themePreference;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: formatUserResponse(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
