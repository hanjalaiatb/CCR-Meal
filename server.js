const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://hanjalaiatb:yourpassword@cluster0.xxxx.mongodb.net/ccr_meals?retryWrites=true&w=majority';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Cloud'))
    .catch(err => console.error('MongoDB connection error:', err));

// Meal Schema & Model
const mealSchema = new mongoose.Schema({
    dateStr: { type: String, required: true },
    id: { type: String, required: true },
    shift: { type: String, required: true },
    meal: { type: String, required: true },
    menuOption: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Meal = mongoose.model('Meal', mealSchema);

// API: Submit or update a meal entry
app.post('/api/submit', async (req, res) => {
    try {
        const { dateStr, id, shift, meal, menuOption } = req.body;
        if (!dateStr || !id || !shift || !meal || !menuOption) {
            return res.status(400).json({ success: false, error: 'All fields are required.' });
        }

        // Remove any existing entry for this employee, date, and meal type to prevent duplicates
        await Meal.deleteOne({ dateStr, id, meal });

        const newMeal = new Meal({ dateStr, id, shift, meal, menuOption });
        await newMeal.save();

        res.json({ success: true, message: 'Meal entry saved successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Delete a meal record
app.post('/api/delete', async (req, res) => {
    try {
        const { dateStr, id, meal } = req.body;
        const result = await Meal.deleteOne({ dateStr, id, meal });

        if (result.deletedCount > 0) {
            res.json({ success: true, message: 'Record deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Record not found.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Get formatted summary for a specific date
app.get('/api/summary', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'Date query parameter is required.' });

        const entries = await Meal.find({ dateStr: date });
        const shifts = ['Morning', 'Afternoon', 'Night'];
        const meals = ['Breakfast', 'Lunch', 'Dinner'];
        const summaryResult = {};

        meals.forEach(mealType => {
            const mealEntries = entries.filter(e => e.meal === mealType);
            if (mealEntries.length === 0) {
                summaryResult[mealType] = null;
                return;
            }

            let textOutput = `${mealType.toUpperCase()} SUMMARY\n`;
            let copyList = [];

            shifts.forEach(shiftName => {
                const shiftEntries = mealEntries.filter(e => e.shift === shiftName);
                if (shiftEntries.length > 0) {
                    textOutput += `${shiftName} Shift\n`;
                    shiftEntries.forEach(entry => {
                        const icon = entry.menuOption === 'Fried Egg' ? 'F' : entry.menuOption === 'Poached Egg' ? 'P' : entry.menuOption === 'Mutton' ? 'M' : 'Regular';
                        textOutput += `ID : ${entry.id} (${icon})\n`;
                        copyList.push(entry.id);
                    });
                }
            });

            // Count calculations
            const fCount = mealEntries.filter(e => e.menuOption === 'Fried Egg').length;
            const pCount = mealEntries.filter(e => e.menuOption === 'Poached Egg').length;
            const mCount = mealEntries.filter(e => e.menuOption === 'Mutton').length;
            const totalCount = mealEntries.length;

            textOutput += `Count :\n`;
            if (fCount > 0) textOutput += `F- ${fCount} `;
            if (pCount > 0) textOutput += `P- ${pCount} `;
            if (mCount > 0) textOutput += `M- ${mCount} `;
            textOutput += `Total- ${totalCount}\n\n`;

            textOutput += `Copy section:\n${copyList.join(', ')}`;

            summaryResult[mealType] = { text: textOutput };
        });

        res.json(summaryResult);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
