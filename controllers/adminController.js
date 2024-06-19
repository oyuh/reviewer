const db = require('../public/database');
const { v4: uuidv4 } = require('uuid');
const SUPERADMIN_USERNAMES = ['law'];

exports.ensureSuperAdmin = (req, res, next) => {
    if (!req.session.user || !SUPERADMIN_USERNAMES.includes(req.session.user.username)) {
        return res.redirect('/login');
    }
    next();
};

exports.getAdminPage = (req, res) => {
    db.all('SELECT * FROM users', (err, users) => {
        if (err) {
            console.error('Error fetching users:', err);
            req.session.errorMessage = "An error occurred while fetching users.";
            users = [];
        }

        db.all('SELECT * FROM items', (err, posts) => {
            if (err) {
                console.error('Error fetching posts:', err);
                req.session.errorMessage = "An error occurred while fetching posts.";
                posts = [];
            }

            db.all('SELECT * FROM logs ORDER BY timestamp DESC', (err, logs) => {  // Fetch logs in descending order
                if (err) {
                    console.error('Error fetching logs:', err);
                    req.session.errorMessage = "An error occurred while fetching logs.";
                    logs = [];
                }

                res.render('admin', {
                    sessionUser: req.session.user,
                    users,
                    posts,
                    logs,
                    errorMessage: req.session.errorMessage,
                    SUPERADMIN_USERNAMES
                });
                delete req.session.errorMessage;
            });
        });
    });
};

exports.updateUsername = (req, res) => {
    const { userId, newUsername } = req.body;

    db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId], function (err) {
        if (err) {
            console.error('Error updating username:', err);
            return res.redirect('/admin');
        }

        db.run('UPDATE items SET creator = ? WHERE creatorId = ?', [newUsername, userId], function (err) {
            if (err) {
                console.error('Error updating items:', err);
            }
        });

        db.run('UPDATE likes SET username = ? WHERE userId = ?', [newUsername, userId], function (err) {
            if (err) {
                console.error('Error updating likes:', err);
            }
        });

        db.run('UPDATE logs SET user = ? WHERE userId = ?', [newUsername, userId], function (err) {
            if (err) {
                console.error('Error updating logs:', err);
            }
        });

        req.session.user.username = newUsername;
        res.redirect('/admin');
    });
};

exports.removeUser = (req, res) => {
    const { userId } = req.body;

    db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
        if (err) {
            console.error('Error removing user:', err);
            return res.redirect('/admin');
        }

        db.run('DELETE FROM items WHERE creatorId = ?', [userId], function (err) {
            if (err) {
                console.error('Error removing user items:', err);
            }
        });

        db.run('DELETE FROM likes WHERE userId = ?', [userId], function (err) {
            if (err) {
                console.error('Error removing user likes:', err);
            }
        });

        db.run('DELETE FROM logs WHERE userId = ?', [userId], function (err) {
            if (err) {
                console.error('Error removing user logs:', err);
            }
        });

        res.redirect('/admin');
    });
};

exports.updatePost = (req, res) => {
    const { id, value, imageLink, creator } = req.body;
    
    db.run('UPDATE items SET value = ?, imageLink = ?, creator = ? WHERE id = ?', [value, imageLink, creator, id], function(err) {
        if (err) {
            console.error('Error updating post:', err);
            req.session.errorMessage = "An error occurred while updating the post.";
            return res.redirect('/admin');
        }

        // Log the update action
        const logId = uuidv4();
        const timestamp = new Date().toISOString();
        const logDetails = `Post ${id} updated by ${req.session.user.username}`;

        db.run('INSERT INTO logs (id, action, timestamp, details, user, userId) VALUES (?, ?, ?, ?, ?, ?)', 
               [logId, 'update', timestamp, logDetails, req.session.user.username, req.session.user.id], (err) => {
            if (err) {
                console.error('Error logging post update:', err);
            }
            res.redirect('/admin');
        });
    });
};

exports.removePost = (req, res) => {
    const { id } = req.body;
    
    db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error removing post:', err);
            req.session.errorMessage = "An error occurred while removing the post.";
            return res.redirect('/admin');
        }

        // Log the remove action
        const logId = uuidv4();
        const timestamp = new Date().toISOString();
        const logDetails = `Post ${id} removed by ${req.session.user.username}`;

        db.run('INSERT INTO logs (id, action, timestamp, details, user, userId) VALUES (?, ?, ?, ?, ?, ?)', 
               [logId, 'remove', timestamp, logDetails, req.session.user.username, req.session.user.id], (err) => {
            if (err) {
                console.error('Error logging post removal:', err);
            }
            res.redirect('/admin');
        });
    });
};

exports.setAdmin = (req, res) => {
    const { userId } = req.body;

    db.run('UPDATE users SET isAdmin = 1 WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error('Error setting admin:', err);
            req.session.errorMessage = "An error occurred while setting admin.";
            return res.redirect('/admin');
        }

        // Log the set admin action
        const logId = uuidv4();
        const timestamp = new Date().toISOString();
        const logDetails = `User ${userId} set as admin by ${req.session.user.username}`;

        db.run('INSERT INTO logs (id, action, timestamp, details, user, userId) VALUES (?, ?, ?, ?, ?, ?)', 
               [logId, 'setAdmin', timestamp, logDetails, req.session.user.username, req.session.user.id], (err) => {
            if (err) {
                console.error('Error logging set admin:', err);
            }
            res.redirect('/admin');
        });
    });
};
