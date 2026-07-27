const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public folder (or root if files are there)
app.use(express.static(__dirname));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable is not defined!");
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("Connected to MongoDB Cloud");
})
.catch((err) => {
  console.error("MongoDB connection error:", err);
});

// Define Meal Schema & Model
const mealSchema = new mongoose.Schema({
  date: { type: String, required: true },
  mealType: { type: String, required: true },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Meal = mongoose.model('Meal', mealSchema);

// API Route to Save Meal Entry
app.post('/api/meals', async (req, res) => {
  try {
    const { date, mealType, description } = req.body;
    
    if (!date || !mealType || !description) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const newMeal = new Meal({ date, mealType, description });
    await newMeal.save();

    res.status(201).json({ success: true, message: 'Meal saved successfully!' });
  } catch (error) {
    console.error('Error saving meal:', error);
    res.status(500).json({ success: false, message: 'Server error while saving meal.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
