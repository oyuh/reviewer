const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password TEXT, isAdmin INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, value TEXT, creator TEXT, timestamp TEXT, imageLink TEXT, creatorId TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, action TEXT, timestamp TEXT, details TEXT, user TEXT, userId TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS likes (id TEXT PRIMARY KEY, itemId TEXT, username TEXT, FOREIGN KEY(itemId) REFERENCES items(id), FOREIGN KEY(username) REFERENCES users(username))");
});

module.exports = db;