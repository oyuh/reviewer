const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');
const bcrypt = require('bcrypt');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password TEXT, isAdmin INTEGER, timeReg TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, value TEXT, creator TEXT, timestamp TEXT, imageLink TEXT, creatorId TEXT, category TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, action TEXT, timestamp TEXT, details TEXT, user TEXT, userId TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS likes (id TEXT PRIMARY KEY, itemId TEXT, username TEXT, userId TEXT, FOREIGN KEY(itemId) REFERENCES items(id), FOREIGN KEY(username) REFERENCES users(username))");

        // Ensure superadmin creation]
        const superadmins = [
            { id: 'lawID', username: 'law', password: bcrypt.hashSync('1234', 10), isAdmin: 1 }
        ];
    
        superadmins.forEach(admin => {
            db.run("INSERT OR IGNORE INTO users (id, username, password, isAdmin, timeReg) VALUES (?, ?, ?, ?, ?)",
                [admin.id, admin.username, admin.password, admin.isAdmin, new Date().toISOString()]);
        });
});

module.exports = db;
