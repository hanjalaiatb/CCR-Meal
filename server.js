const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. MongoDB Connection (Your exact MongoDB Atlas Connection String)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:L3tsst%40rt@cluster0.0sw1cqb.mongodb.net/mealsApp?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Cloud'))
    .catch(err => console.error('MongoDB connection error:', err));

// 2. Database Schemas & Models
const MealSchema = new mongoose.Schema({
    dateStr: { type: String, required: true }, // Format: "YYYY-MM-DD"
    id: { type: String, required: true },
    shift: { type: String, required: true },
    meal: { type: String, required: true },
    menuOption: { type: String, default: 'None' }
});

const HistorySchema = new mongoose.Schema({
    type: String,
    id: String,
    meal: String,
    date: String,
    details: String,
    time: String,
    createdAt: { type: Date, default: Date.now }
});

const Meal = mongoose.model('Meal', MealSchema);
const History = mongoose.model('History', HistorySchema);

// Helper function to log actions into history
async function logHistory(type, id, meal, date, details) {
    try {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await History.create({ type, id, meal, date, details, time });
    } catch (err) {
        console.error('History log error:', err);
    }
}

// 3. API Routes

// Get entries for a specific date
app.get('/api/meals', async (req, res) => {
    try {
        const { date } = req.query;
        const query = date ? { dateStr: date } : {};
        const meals = await Meal.find(query);
        res.json(meals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit or update a meal entry
app.post('/api/submit', async (req, res) => {
    try {
        const { dateStr, id, shift, meal, menuOption } = req.body;
        
        let existing = await Meal.findOne({ dateStr, id, meal });

        if (existing) {
            const oldShift = existing.shift;
            const oldOption = existing.menuOption;
            existing.shift = shift;
            existing.menuOption = menuOption;
            await existing.save();

            await logHistory('MODIFY', id, meal, dateStr, `Shift: ${oldShift}➔${shift} | Option: ${oldOption}➔${menuOption}`);
        } else {
            await Meal.create({ dateStr, id, shift, meal, menuOption });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete a meal entry
app.post('/api/delete', async (req, res) => {
    try {
        const { dateStr, id, meal } = req.body;
        const result = await Meal.deleteOne({ dateStr, id, meal });

        if (result.deletedCount > 0) {
            await logHistory('DELETE', id, meal, dateStr, 'Entry deleted from system.');
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Record not found.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Generate formatted summary output
app.get('/api/summary', async (req, res) => {
    try {
        const { date } = req.query;
        const entries = await Meal.find({ dateStr: date });
        const result = {};

        ['Breakfast', 'Lunch', 'Dinner'].forEach(mealType => {
            const mealEntries = entries.filter(e => e.meal === mealType);
            if (mealEntries.length === 0) return;

            let output = `${mealType} Summary\n\n`;
            let allShiftIds = [];
            let globalCounts = { F: 0, P: 0, M: 0, Total: 0 };
            let friedIds = [], poachedIds = [], muttonIds = [];

            ['Morning', 'Afternoon', 'Night'].forEach(shiftType => {
                const shiftEntries = mealEntries.filter(e => e.shift === shiftType);
                if (shiftEntries.length === 0) return;

                output += `${shiftType} Shift\n`;
                let shiftCounts = { F: 0, P: 0, M: 0, Total: shiftEntries.length };
                let formattedIds = [];

                shiftEntries.forEach(e => {
                    allShiftIds.push(e.id);
                    globalCounts.Total++;
                    let code = '';
                    if (e.menuOption === 'Fried Egg') { code = '(F)'; shiftCounts.F++; globalCounts.F++; friedIds.push(e.id); }
                    else if (e.menuOption === 'Poached Egg') { code = '(P)'; shiftCounts.P++; globalCounts.P++; poachedIds.push(e.id); }
                    else if (e.menuOption === 'Mutton') { code = '(M)'; shiftCounts.M++; globalCounts.M++; muttonIds.push(e.id); }
                    formattedIds.push(`${e.id}${code}`);
                });

                output += `ID : ${formattedIds.join(', ')}\n`;
                let shiftCountParts = [];
                if (shiftCounts.F > 0) shiftCountParts.push(`F-${shiftCounts.F}`);
                if (shiftCounts.P > 0) shiftCountParts.push(`P-${shiftCounts.P}`);
                if (shiftCounts.M > 0) shiftCountParts.push(`M-${shiftCounts.M}`);
                shiftCountParts.push(`Total- ${shiftCounts.Total}`);
                output += `Count: ${shiftCountParts.join(', ')}\n\n`;
            });

            let allShiftParts = [];
            if (globalCounts.F > 0) allShiftParts.push(`F- ${globalCounts.F}`);
            if (globalCounts.P > 0) allShiftParts.push(`P- ${globalCounts.P}`);
            if (globalCounts.M > 0) allShiftParts.push(`M- ${globalCounts.M}`);
            allShiftParts.push(`Total- ${globalCounts.Total}`);

            output += `All Shift\nCount : ${allShiftParts.join(', ')}\n\n`;

            const dateParts = date.split('-');
            const formattedDate = `${parseInt(dateParts[2])}/${parseInt(dateParts[1])}/${dateParts[0]}`;

            output += `Copy section:\n`;
            output += `Date : ${formattedDate}\n`;
            output += `${mealType} Meal ID from CCR: ${allShiftIds.join(', ')}\n`;
            output += `Total ID count: ${globalCounts.Total}.\n`;

            if (friedIds.length > 0) output += `Fried Egg count: ${friedIds.length}(${friedIds.join(', ')})\n`;
            if (poachedIds.length > 0) output += `Poached Egg count: ${poachedIds.length}(${poachedIds.join(', ')})\n`;
            if (muttonIds.length > 0) output += `Mutton count: ${muttonIds.length}(${muttonIds.join(', ')})\n`;

            result[mealType] = { text: output.trim() };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch recent audit logs
app.get('/api/history', async (req, res) => {
    try {
        const logs = await History.find().sort({ createdAt: -1 }).limit(10);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all route to serve the frontend single-page application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
