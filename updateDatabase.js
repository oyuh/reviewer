const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        isAdmin INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        value TEXT,
        creator TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        imageLink TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS likes (
        id TEXT PRIMARY KEY,
        itemId TEXT,
        username TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        action TEXT,
        user TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT
    )`);
});

console.log('Database schema updated');
db.close();
