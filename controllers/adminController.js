const db = require('../public/database');
const { v4: uuidv4 } = require('uuid');
const SUPERADMIN_USERNAMES = ['law'];

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

            db.all('SELECT * FROM logs ORDER BY timestamp DESC', (err, logs) => {
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

exports.editPost = (req, res) => {
    const { id, value, creator, imageLink } = req.body;

    db.run("UPDATE items SET value = ?, creator = ?, imageLink = ? WHERE id = ?", [value, creator, imageLink, id], (err) => {
        if (err) {
            console.error('Error updating post:', err);
            req.session.errorMessage = 'An error occurred while updating the post.';
            logAction('edit_post_error', err.message, req.session.user.username, req.session.user.id);
        } else {
            logAction('edit_post', 'Post updated successfully', req.session.user.username, req.session.user.id);
        }
        res.redirect('/admin');
    });
};

exports.removePost = (req, res) => {
    const { id } = req.body;

    db.run("DELETE FROM items WHERE id = ?", [id], (err) => {
        if (err) {
            console.error('Error removing post:', err);
            req.session.errorMessage = 'An error occurred while removing the post.';
            logAction('remove_post_error', err.message, req.session.user.username, req.session.user.id);
        } else {
            logAction('remove_post', 'Post removed successfully', req.session.user.username, req.session.user.id);
        }
        res.redirect('/admin');
    });
};

function logAction(action, details, username, userId = null) {
    const logId = uuidv4();
    const timestamp = new Date().toISOString();
    const logDetails = [logId, action, timestamp, details, username, userId];

    db.run("INSERT INTO logs (id, action, timestamp, details, user, userId) VALUES (?, ?, ?, ?, ?, ?)", logDetails, (err) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}
