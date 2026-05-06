const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pazienti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paziente TEXT,
        referto TEXT,
        data DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

module.exports = {
    getAll: () => new Promise((res, rej) => {
        db.all("SELECT * FROM pazienti ORDER BY data DESC", (err, rows) => err ? rej(err) : res(rows));
    }),
    insert: (p, r) => new Promise((res, rej) => {
        db.run("INSERT INTO pazienti (paziente, referto) VALUES (?, ?)", [p, r], (err) => err ? rej(err) : res());
    }),
    remove: (id) => new Promise((res, rej) => {
        db.run("DELETE FROM pazienti WHERE id = ?", id, (err) => err ? rej(err) : res());
    })
};