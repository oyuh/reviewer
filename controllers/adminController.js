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

            db.all('SELECT * FROM logs', (err, logs) => {
                if (err) {
                    console.error('Error fetching logs:', err);
                    req.session.errorMessage = "An error occurred while fetching logs.";
                    logs = [];
                }

                res.render('admin', {
                    user: req.session.user,
                    logs,
                    users,
                    posts,
                    errorMessage: req.session.errorMessage,
                    SUPERADMIN_USERNAMES
                });
                delete req.session.errorMessage;
            });
        });
    });
};

exports.editUser = (req, res) => {
    const { id, username } = req.body;

    db.run("UPDATE users SET username = ? WHERE id = ?", [username, id], (err) => {
        if (err) {
            console.error('Error updating user:', err);
            req.session.errorMessage = 'An error occurred while updating the user.';
            logAction('edit_user_error', err.message, req.session.user.username, req.session.user.id);
        } else {
            logAction('edit_user', 'User updated successfully', req.session.user.username, req.session.user.id);
        }
        res.redirect('/admin');
    });
};

exports.removeUser = (req, res) => {
    const { id } = req.body;

    db.run("DELETE FROM users WHERE id = ?", [id], (err) => {
        if (err) {
            console.error('Error removing user:', err);
            req.session.errorMessage = 'An error occurred while removing the user.';
            logAction('remove_user_error', err.message, req.session.user.username, req.session.user.id);
        } else {
            logAction('remove_user', 'User removed successfully', req.session.user.username, req.session.user.id);
        }
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
