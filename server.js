const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ccr-meal-tracker';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('DB error:', err));

// Meal Schema
const mealSchema = new mongoose.Schema({
    dateStr: { type: String, required: true },
    id: { type: String, required: true },
    shift: { type: String, required: true },
    meal: { type: String, required: true },
    menuOption: { type: String, required: true, default: 'Regular' }
});

mealSchema.index({ dateStr: 1, id: 1, meal: 1 }, { unique: true });
const Meal = mongoose.model('Meal', mealSchema);

// Submit or Update Entry
app.post('/api/submit', async (req, res) => {
    try {
        const { dateStr, id, shift, meal, menuOption } = req.body;
        if (!dateStr || !id || !shift || !meal) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        const existing = await Meal.findOne({ dateStr, id, meal });
        const isNew = !existing;

        const updatedRecord = await Meal.findOneAndUpdate(
            { dateStr, id, meal },
            { shift, menuOption },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ success: true, isNew, data: updatedRecord });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Fetch Summary Data
app.get('/api/summary', async (req, res) => {
    try {
        const { dateStr } = req.query;
        if (!dateStr) return res.status(400).json({ success: false, error: 'Date required' });
        const records = await Meal.find({ dateStr });
        res.status(200).json({ success: true, records });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete Record
app.post('/api/delete', async (req, res) => {
    try {
        const { id, dateStr, meal } = req.body;
        if (!id || !dateStr || !meal) return res.status(400).json({ success: false, error: 'Missing parameters' });

        const result = await Meal.findOneAndDelete({ id, dateStr, meal });
        if (!result) return res.status(404).json({ success: false, error: 'Not found' });

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
