const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable is not defined!");
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB Cloud"))
.catch((err) => console.error("MongoDB connection error:", err));

const mealSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  date: { type: String, required: true },
  shift: { type: String, required: true },
  mealType: { type: String, required: true },
  menuOption: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Meal = mongoose.model('Meal', mealSchema);

// Save Meal Entry
app.post('/api/meals', async (req, res) => {
  try {
    const { employeeId, date, shift, mealType, menuOption } = req.body;
    
    if (!employeeId || !date || !shift || !mealType || !menuOption) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const newMeal = new Meal({ employeeId, date, shift, mealType, menuOption });
    await newMeal.save();

    res.status(201).json({ success: true, message: 'Meal saved successfully!' });
  } catch (error) {
    console.error('Error saving meal:', error);
    res.status(500).json({ success: false, message: 'Server error while saving meal.' });
  }
});

// Get Summary By Date
app.get('/api/meals/summary', async (req, res) => {
  try {
    const { date } = req.query;
    const query = date ? { date } : {};
    const meals = await Meal.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, meals });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ success: false, message: 'Server error fetching summary.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
