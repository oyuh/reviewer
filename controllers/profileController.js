const db = require('../public/database');
const { v4: uuidv4 } = require('uuid');

exports.getProfile = (req, res) => {
    const username = req.params.username || req.session.user.username;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.render('error', { errorMessage: 'An error occurred while fetching user data.', sessionUser: req.session.user });
        }

        if (!user) {
            return res.render('error', { errorMessage: 'User not found.', sessionUser: req.session.user });
        }

        db.all('SELECT * FROM items WHERE creator = ?', [username], (err, posts) => {
            if (err) {
                console.error('Error fetching posts:', err);
                return res.render('error', { errorMessage: 'An error occurred while fetching posts.', sessionUser: req.session.user });
            }

            db.get('SELECT COUNT(*) as postCount FROM items WHERE creator = ?', [username], (err, postCount) => {
                if (err) {
                    console.error('Error fetching post count:', err);
                    return res.render('error', { errorMessage: 'An error occurred while fetching post count.', sessionUser: req.session.user });
                }

                db.get('SELECT COUNT(*) as likeCount FROM likes WHERE username = ?', [username], (err, likeCount) => {
                    if (err) {
                        console.error('Error fetching like count:', err);
                        return res.render('error', { errorMessage: 'An error occurred while fetching like count.', sessionUser: req.session.user });
                    }

                    db.all('SELECT * FROM likes', (err, likes) => {
                        if (err) {
                            console.error('Error fetching likes:', err);
                            return res.render('error', { errorMessage: 'An error occurred while fetching likes.', sessionUser: req.session.user });
                        }

                        const userLikes = {};
                        likes.forEach(like => {
                            if (!userLikes[like.itemId]) {
                                userLikes[like.itemId] = [];
                            }
                            userLikes[like.itemId].push(like.username);
                        });

                        const isOwner = username === req.session.user.username;
                        res.render('profile', {
                            user,
                            posts,
                            postCount: postCount.postCount,
                            likeCount: likeCount.likeCount,
                            isOwner,
                            sessionUser: req.session.user,
                            userLikes,
                            likes: userLikes
                        });
                    });
                });
            });
        });
    });
};

exports.getProfileByUsername = (req, res) => {
    const username = req.params.username;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.render('error', { errorMessage: 'An error occurred while fetching user data.', sessionUser: req.session.user });
        }

        if (!user) {
            return res.render('error', { errorMessage: 'User not found.', sessionUser: req.session.user });
        }

        db.all('SELECT * FROM items WHERE creator = ?', [username], (err, posts) => {
            if (err) {
                console.error('Error fetching posts:', err);
                return res.render('error', { errorMessage: 'An error occurred while fetching posts.', sessionUser: req.session.user });
            }

            db.get('SELECT COUNT(*) as postCount FROM items WHERE creator = ?', [username], (err, postCount) => {
                if (err) {
                    console.error('Error fetching post count:', err);
                    return res.render('error', { errorMessage: 'An error occurred while fetching post count.', sessionUser: req.session.user });
                }

                db.get('SELECT COUNT(*) as likeCount FROM likes WHERE username = ?', [username], (err, likeCount) => {
                    if (err) {
                        console.error('Error fetching like count:', err);
                        return res.render('error', { errorMessage: 'An error occurred while fetching like count.', sessionUser: req.session.user });
                    }

                    db.all('SELECT * FROM likes', (err, likes) => {
                        if (err) {
                            console.error('Error fetching likes:', err);
                            return res.render('error', { errorMessage: 'An error occurred while fetching likes.', sessionUser: req.session.user });
                        }

                        const userLikes = {};
                        likes.forEach(like => {
                            if (!userLikes[like.itemId]) {
                                userLikes[like.itemId] = [];
                            }
                            userLikes[like.itemId].push(like.username);
                        });

                        res.render('profile', {
                            user,
                            posts,
                            postCount: postCount.postCount,
                            likeCount: likeCount.likeCount,
                            isOwner: false,
                            sessionUser: req.session.user,
                            userLikes,
                            likes: userLikes
                        });
                    });
                });
            });
        });
    });
};

exports.editUsername = (req, res) => {
    const { userId, newName } = req.body;

    db.run("UPDATE users SET username = ? WHERE id = ?", [newName, userId], (err) => {
        if (err) {
            console.error('Error updating username:', err);
            req.session.errorMessage = 'An error occurred while updating the username.';
        }

        db.run('UPDATE items SET creator = ? WHERE creatorId = ?', [newName, userId], function (err) {
            if (err) {
                console.error('Error updating items:', err);
            }
        });

        db.run('UPDATE likes SET username = ? WHERE userId = ?', [newName, userId], function (err) {
            if (err) {
                console.error('Error updating likes:', err);
            }
        });

        db.run('UPDATE logs SET user = ? WHERE userId = ?', [newName, userId], function (err) {
            if (err) {
                console.error('Error updating logs:', err);
            }
        });

        req.session.user.username = newName;
        res.redirect('/profile');
    });
};

exports.editPost = (req, res) => {
    const { id, value, imageUrl } = req.body;

    db.run("UPDATE items SET value = ?, imageUrl = ? WHERE id = ?", [value, imageUrl, id], (err) => {
        if (err) {
            console.error('Error updating post:', err);
            req.session.errorMessage = 'An error occurred while updating the post.';
        }
        res.redirect('/profile');
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
