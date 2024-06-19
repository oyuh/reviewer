const db = require('../public/database');
const { v4: uuidv4 } = require('uuid');

exports.getItems = (req, res) => {
    const filterUser = req.query['filter-user'];
    const filterDate = req.query['filter-date'];
    const selectedCategory = req.query.category || 'category1';

    let sql = "SELECT * FROM items";
    const params = [];

    if (filterUser) {
        sql += params.length ? " AND creator = ?" : " WHERE creator = ?";
        params.push(filterUser);
    }

    if (filterDate) {
        sql += params.length ? " AND DATE(timestamp) = DATE(?)" : " WHERE DATE(timestamp) = DATE(?)";
        params.push(filterDate);
    }

    db.all(sql, params, (err, items) => {
        if (err) {
            console.error('Error fetching items:', err);
            items = [];
        }

        db.all("SELECT * FROM likes", [], (err, likesRows) => {
            if (err) {
                console.error('Error fetching likes:', err);
                likesRows = [];
            }

            const likes = likesRows.reduce((acc, like) => {
                acc[like.itemId] = acc[like.itemId] || [];
                acc[like.itemId].push(like.username);
                return acc;
            }, {});

            const userLikes = req.session.user
                ? likesRows.filter(like => like.username === req.session.user.username).reduce((acc, like) => {
                    acc[like.itemId] = true;
                    return acc;
                }, {})
                : {};

            const categorizedItems = {
                category1: items.filter(item => item.category === 'category1'),
                category2: items.filter(item => item.category === 'category2'),
                category3: items.filter(item => item.category === 'category3')
            };

            res.render('index', {
                categorizedItems,
                selectedId: req.query.selectedId,
                user: req.session.user,
                likes,
                userLikes,
                items,
                selectedCategory,
                errorMessage: req.session.errorMessage
            });
            delete req.session.errorMessage;
        });
    });
};

exports.addItem = (req, res) => {
    const { value, category, imageUrl } = req.body;
    const id = uuidv4();
    const creator = req.session.user.username;
    const creatorId = req.session.user.id;
    const timestamp = new Date().toISOString();

    db.run("INSERT INTO items (id, value, creator, timestamp, imageLink, creatorId, category) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, value, creator, timestamp, imageUrl, creatorId, category], (err) => {
        if (err) {
            console.error('Error adding item:', err);
            req.session.errorMessage = 'An error occurred while adding the item.';
            logAction('add_item_error', err.message, creator, creatorId);
        } else {
            logAction('add_item', 'Item added successfully', creator, creatorId);
        }
        res.redirect('/');
    });
};

exports.updateItem = (req, res) => {
    const { id } = req.params;
    const { value, imageUrl } = req.body;

    db.run("UPDATE items SET value = ?, imageLink = ? WHERE id = ? AND creatorId = ?",
        [value, imageUrl, id, req.session.user.id], (err) => {
        if (err) {
            console.error('Error updating item:', err);
            req.session.errorMessage = 'An error occurred while updating the item.';
            logAction('update_item_error', err.message, req.session.user.username, req.session.user.id);
        } else {
            logAction('update_item', 'Item updated successfully', req.session.user.username, req.session.user.id);
        }
        res.redirect('/');
    });
};

exports.removeItem = (req, res) => {
    const { id } = req.params;

    db.run("DELETE FROM items WHERE id = ? AND creatorId = ?", [id, req.session.user.id], (err) => {
        if (err) {
            console.error('Error removing item:', err);
            req.session.errorMessage = 'An error occurred while removing the item.';
            logAction('remove_item_error', err.message, req.session.user.username, req.session.user.id);
        } else {
            logAction('remove_item', 'Item removed successfully', req.session.user.username, req.session.user.id);
        }
        res.redirect('/');
    });
};

exports.likeItem = (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    const username = req.session.user.username;
    const likeId = uuidv4();

    db.run("INSERT INTO likes (id, itemId, username, userId) VALUES (?, ?, ?, ?)", [likeId, id, username, userId], (err) => {
        if (err) {
            console.error('Error liking item:', err);
            req.session.errorMessage = 'An error occurred while liking the item.';
            logAction('like_item_error', err.message, username, userId);
        } else {
            logAction('like_item', 'Item liked successfully', username, userId);
        }
        res.redirect('/');
    });
};

exports.unlikeItem = (req, res) => {
    const { id } = req.params;
    const username = req.session.user.username;

    db.run("DELETE FROM likes WHERE itemId = ? AND username = ?", [id, username], (err) => {
        if (err) {
            console.error('Error unliking item:', err);
            req.session.errorMessage = 'An error occurred while unliking the item.';
            logAction('unlike_item_error', err.message, username, req.session.user.id);
        } else {
            logAction('unlike_item', 'Item unliked successfully', username, req.session.user.id);
        }
        res.redirect('/');
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
