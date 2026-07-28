const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ccr-meal-tracker';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('DB error:', err));

const mealSchema = new mongoose.Schema({
    dateStr: { type: String, required: true },
    id: { type: String, required: true },
    shift: { type: String, required: true },
    meal: { type: String, required: true },
    menuOption: { type: String, required: true, default: 'Regular' }
});

mealSchema.index({ dateStr: 1, id: 1, meal: 1 }, { unique: true });
const Meal = mongoose.model('Meal', mealSchema);

// Native MongoDB TTL index: automatically deletes logs after 48 hours (172800s) without blocking RAM
const logSchema = new mongoose.Schema({
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 172800 }
});
const Log = mongoose.model('Log', logSchema);

app.post('/api/submit', async (req, res) => {
    try {
        const { dateStr, id, shift, meal, menuOption } = req.body;
        if (!dateStr || !id || !shift || !meal) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        const existing = await Meal.findOne({ dateStr, id, meal });

        if (!existing) {
            const newRecord = await Meal.create({ dateStr, id, shift, meal, menuOption });
            return res.status(200).json({ success: true, status: 'added', data: newRecord });
        }

        if (existing.shift === shift && existing.menuOption === menuOption) {
            return res.status(200).json({ success: true, status: 'duplicate', data: existing });
        }

        existing.shift = shift;
        existing.menuOption = menuOption;
        const updatedRecord = await existing.save();

        res.status(200).json({ success: true, status: 'modified', data: updatedRecord });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/summary', async (req, res) => {
    try {
        const { dateStr } = req.query;
        if (!dateStr) return res.status(400).json({ success: false, error: 'Date required' });
        const records = await Meal.find({ dateStr }).lean();
        res.status(200).json({ success: true, records });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

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

app.get('/api/logs', async (req, res) => {
    try {
        const logs = await Log.find().sort({ _id: -1 }).limit(15).lean();
        res.status(200).json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/logs', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, error: 'Missing text' });
        await Log.create({ text });
        
        // Lightweight trim to max 15 logs capacity
        const count = await Log.countDocuments();
        if (count > 15) {
            const oldest = await Log.find().sort({ createdAt: 1 }).limit(count - 15).lean();
            await Log.deleteMany({ _id: { $in: oldest.map(l => l._id) } });
        }

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
