const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('./database.db');

db.serialize(() => {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        isAdmin INTEGER DEFAULT 0
    )`);

    // Create items table
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        creator TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create logs table
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        user TEXT
    )`);

    // Create likes table
    db.run(`CREATE TABLE IF NOT EXISTS likes (
        id TEXT PRIMARY KEY,
        itemId TEXT NOT NULL,
        username TEXT NOT NULL,
        FOREIGN KEY (itemId) REFERENCES items (id),
        FOREIGN KEY (username) REFERENCES users (username)
    )`);
});

db.close();