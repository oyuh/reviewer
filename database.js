const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, value TEXT, creator TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password TEXT, isAdmin INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, action TEXT, timestamp TEXT, details TEXT)");
});

module.exports = db;
