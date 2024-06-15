const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run("ALTER TABLE logs ADD COLUMN details TEXT", (err) => {
        if (err) {
            console.error("Column may already exist:", err.message);
        } else {
            console.log("Details column added successfully");
        }
    });
});

db.close();
