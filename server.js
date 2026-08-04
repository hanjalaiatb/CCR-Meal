const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Optimized Mongoose settings to prevent memory leaks on free tiers
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ccr-meal-tracker', {
    maxPoolSize: 2, // Keep connection pool small to save RAM
    serverSelectionTimeoutMS: 5000
}).catch(err => console.error('DB error:', err));

const Meal = mongoose.model('Meal', new mongoose.Schema({
    dateStr: { type: String, required: true },
    id: { type: String, required: true },
    shift: { type: String, required: true },
    meal: { type: String, required: true },
    menuOption: { type: String, required: true, default: 'Regular' },
    createdAt: { type: Date, default: Date.now, expires: 172800 } // Auto-delete after 48h
}));

app.post('/api/submit', async (req, res) => {
    try {
        const { dateStr, id, shift, meal, menuOption } = req.body;
        if (!dateStr || !id || !shift || !meal) return res.status(400).json({ success: false });

        const existing = await Meal.findOne({ dateStr, id, meal }).lean();
        if (existing) {
            if (existing.shift === shift && existing.menuOption === menuOption) {
                return res.json({ success: true, status: 'duplicate' });
            }
            await Meal.updateOne({ _id: existing._id }, { shift, menuOption });
            return res.json({ success: true, status: 'modified' });
        }

        await Meal.create({ dateStr, id, shift, meal, menuOption });
        res.json({ success: true, status: 'added' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/summary', async (req, res) => {
    try {
        const records = await Meal.find({ dateStr: req.query.dateStr }).lean();
        res.json({ success: true, records });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/delete', async (req, res) => {
    try {
        const { id, dateStr, meal } = req.body;
        const result = await Meal.findOneAndDelete({ id: id.trim(), dateStr, meal });
        if (!result) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
