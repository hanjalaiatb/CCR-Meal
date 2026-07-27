const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join('/tmp', 'meals.json');
const HISTORY_FILE = path.join('/tmp', 'history.json');

// Helper Functions
function getData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function saveData(data) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
}

function getHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) return [];
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) { return []; }
}

function logHistory(type, id, meal, date, details) {
    try {
        const history = getHistory();
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        history.push({ type, id, meal, date, details, time });
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (e) {}
}

// Serve Frontend Landing Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.get('/api/check-entry', (req, res) => {
    const { date, id, meal } = req.query;
    const fileData = getData();
    const entries = fileData[date] || [];
    const existing = entries.find(e => e.id === id && e.meal === meal);
    res.json({ exists: !!existing, entry: existing || null });
});

app.post('/api/submit', (req, res) => {
    const { dateStr, id, shift, meal, menuOption } = req.body;
    const fileData = getData();
    if (!fileData[dateStr]) fileData[dateStr] = [];

    const existingIndex = fileData[dateStr].findIndex(e => e.id === id && e.meal === meal);

    if (existingIndex !== -1) {
        const old = fileData[dateStr][existingIndex];
        logHistory('MODIFY', id, meal, dateStr, `Shift: ${old.shift}➔${shift} | Option: ${old.menuOption}➔${menuOption}`);
        fileData[dateStr][existingIndex] = { id, shift, meal, menuOption };
    } else {
        fileData[dateStr].push({ id, shift, meal, menuOption });
    }

    saveData(fileData);
    res.json({ success: true });
});

app.post('/api/delete', (req, res) => {
    const { dateStr, id, meal } = req.body;
    const fileData = getData();

    if (!fileData[dateStr]) return res.json({ success: false, message: 'No records found for date.' });

    const initialLength = fileData[dateStr].length;
    fileData[dateStr] = fileData[dateStr].filter(e => !(e.id === id && e.meal === meal));

    if (fileData[dateStr].length < initialLength) {
        saveData(fileData);
        logHistory('DELETE', id, meal, dateStr, `Entry deleted from system.`);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'ID not found for specified meal/date.' });
    }
});

app.get('/api/summary', (req, res) => {
    const dateStr = req.query.date;
    const fileData = getData();
    const entries = fileData[dateStr] || [];
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

        const dateParts = dateStr.split('-');
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
});

app.get('/api/history', (req, res) => {
    res.json(getHistory());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
