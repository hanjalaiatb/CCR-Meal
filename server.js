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

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

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
  empId: { type: String, required: true },
  date: { type: String, required: true },
  shift: { type: String, required: true },
  mealType: { type: String, required: true },
  menuOption: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Meal = mongoose.model('Meal', mealSchema);

// POST Endpoint: Save or update (detects modifications)
app.post('/api/meals', async (req, res) => {
  try {
    const { empId, date, shift, mealType, menuOption } = req.body;
    
    if (!empId || !date || !shift || !mealType || !menuOption) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    let existing = await Meal.findOne({ empId, date, mealType });
    let modified = false;

    if (existing) {
      if (existing.shift !== shift || existing.menuOption !== menuOption) {
        modified = true;
      }
      existing.shift = shift;
      existing.menuOption = menuOption;
      await existing.save();
      return res.status(200).json({ success: true, modified, message: 'Updated successfully' });
    }

    const newMeal = new Meal({ empId, date, shift, mealType, menuOption });
    await newMeal.save();
    res.status(201).json({ success: true, modified: false, message: 'Saved successfully' });
  } catch (error) {
    console.error('Error saving meal:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET Endpoint: Fetch meals by date
app.get('/api/meals', async (req, res) => {
  try {
    const { date } = req.query;
    const filter = date ? { date } : {};
    const meals = await Meal.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, meals });
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching meals.' });
  }
});

// DELETE Endpoint: Delete specific entry by ID
app.delete('/api/meals/:id', async (req, res) => {
  try {
    await Meal.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting meal:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
