const db = require('../public/database');
const { v4: uuidv4 } = require('uuid');

exports.logAction = (action, details, user) => {
    const logId = uuidv4();
    const timestamp = new Date().toISOString();

    db.run("INSERT INTO logs (id, action, timestamp, details, user, userId) VALUES (?, ?, ?, ?, ?, ?)",
        [logId, action, timestamp, details, user.username, user.id], (err) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
};
