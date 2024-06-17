const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const db = require('./database');
const app = express();
const path = require('path');
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret1234',
    resave: false,
    saveUninitialized: true
}));

const SUPERADMIN_USERNAMES = ['law'];

function ensureSuperAdmin(req, res, next) {
    if (req.session.user && SUPERADMIN_USERNAMES.includes(req.session.user.username)) {
        next();
    } else {
        res.redirect('/');
    }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let selectedId = null;

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function ensureLoggedIn(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) {
        next();
    } else {
        res.redirect('/');
    }
}

// Middleware to check if user is admin
function checkAdmin(req, res, next) {
    if (req.session.user) {
        db.get("SELECT isAdmin FROM users WHERE id = ?", [req.session.user.id], (err, user) => {
            if (err || !user.isAdmin) {
                req.session.destroy((err) => {
                    if (err) {
                        return console.log(err);
                    }
                    res.redirect('/login');
                });
            } else {
                next();
            }
        });
    } else {
        res.redirect('/login');
    }
}

// Middleware to check if user is superadmin
function checkSuperAdmin(req, res, next) {
    if (req.session.user && SUPERADMIN_USERNAMES.includes(req.session.user.username)) {
        next();
    } else {
        res.redirect('/');
    }
}

app.get('/', (req, res) => {
    const filterUser = req.query['filter-user'];
    const filterDate = req.query['filter-date'];
    let sql = "SELECT * FROM items";
    const params = [];

    if (filterUser) {
        sql += " WHERE creator = ?";
        params.push(filterUser);
    }

    if (filterDate) {
        sql += params.length ? " AND DATE(timestamp) = DATE(?)" : " WHERE DATE(timestamp) = DATE(?)";
        params.push(filterDate);
    }

    db.all(sql, params, (err, items) => {
        if (err) {
            console.error('Error fetching items:', err);
            req.session.errorMessage = "An error occurred while fetching items.";
            items = [];
        }

        db.all("SELECT * FROM likes", [], (err, likesRows) => {
            if (err) {
                console.error('Error fetching likes:', err);
                req.session.errorMessage = "An error occurred while fetching likes.";
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

            res.render('index', { items, selectedId, user: req.session.user, likes, userLikes, errorMessage: req.session.errorMessage });
            delete req.session.errorMessage; // Clear error message after rendering
        });
    });
});

// Route to handle form submission with image link
app.post('/add', checkAuth, (req, res) => {
    const value = req.body.value;
    const imageLink = req.body.imageLink;
    const id = uuidv4();
    const creator = req.session.user.username;
    const timestamp = new Date().toISOString();
    db.run("INSERT INTO items (id, value, creator, timestamp, imageLink) VALUES (?, ?, ?, ?, ?)", [id, value, creator, timestamp, imageLink], (err) => {
        if (err) {
            return console.log(err.message);
        }
        logAction('add', req.session.user.username, `Added value "${value}" with ID "${id}"`);
        res.redirect('/');
    });
});

// Route to handle liking a post
app.post('/like/:id', checkAuth, (req, res) => {
    const itemId = req.params.id;
    const username = req.session.user.username;
    const id = uuidv4();
    db.run("INSERT INTO likes (id, itemId, username) VALUES (?, ?, ?)", [id, itemId, username], (err) => {
        if (err) {
            req.session.errorMessage = "An error occurred. Please try again.";
            res.redirect('/');
            return console.log(err.message);
        }
        res.redirect('/');
    });
});

app.post('/unlike/:id', checkAuth, (req, res) => {
    const itemId = req.params.id;
    const username = req.session.user.username;
    db.run("DELETE FROM likes WHERE itemId = ? AND username = ?", [itemId, username], (err) => {
        if (err) {
            req.session.errorMessage = "An error occurred. Please try again.";
            res.redirect('/');
            return console.log(err.message);
        }
        res.redirect('/');
    });
});

// Route to handle removing an item
app.post('/remove/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (err) {
            return console.log(err.message);
        }
        if (item && (item.creator === req.session.user.username || req.session.user.isAdmin || SUPERADMIN_USERNAMES.includes(req.session.user.username))) {
            db.run("DELETE FROM items WHERE id = ?", [id], (err) => {
                if (err) {
                    return console.log(err.message);
                }
                logAction('remove', req.session.user.username, `Removed value "${item.value}" with ID "${id}"`);
                res.redirect('/');
            });
        } else {
            res.redirect('/');
        }
    });
});

app.post('/select/:id', (req, res) => {
    selectedId = req.params.id;
    res.redirect('/');
});

app.post('/unselect', (req, res) => {
    selectedId = null;
    res.redirect('/');
});

// Route to handle updating an item
app.post('/update/:id', (req, res) => {
    const { value } = req.body;
    const id = req.params.id;
    db.run("UPDATE items SET value = ? WHERE id = ?", [value, id], (err) => {
        if (err) {
            req.session.errorMessage = "An error occurred. Please try again.";
            res.redirect('/');
            return console.log(err.message);
        }
        selectedId = null; // Unselect after updating
        res.redirect('/');
    });
});

// Route to display the registration page
app.get('/register', (req, res) => {
    res.render('register', { errorMessage: req.session.errorMessage || '' });
    delete req.session.errorMessage;
});

// Route to handle user registration
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const id = uuidv4();
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, existingUser) => {
        if (err) {
            req.session.errorMessage = "An error occurred. Please try again.";
            res.redirect('/register');
            return console.log(err.message);
        }
        if (existingUser) {
            req.session.errorMessage = "Username already taken.";
            res.redirect('/register');
        } else {
            const isAdmin = username === 'law' ? 1 : 0;
            db.run("INSERT INTO users (id, username, password, isAdmin) VALUES (?, ?, ?, ?)", [id, username, password, isAdmin], (err) => {
                if (err) {
                    req.session.errorMessage = "An error occurred. Please try again.";
                    res.redirect('/register');
                    return console.log(err.message);
                }
                db.get("SELECT * FROM users WHERE id = ?", [id], (err, newUser) => {
                    if (err) {
                        req.session.errorMessage = "An error occurred. Please try again.";
                        res.redirect('/register');
                        return console.log(err.message);
                    }
                    req.session.user = newUser;
                    delete req.session.errorMessage; // Clear error message on successful registration
                    res.redirect('/');
                });
            });
        }
    });
});

// Route to display the login page
app.get('/login', (req, res) => {
    res.render('login', { errorMessage: req.session.errorMessage || '' });
    delete req.session.errorMessage;
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err) {
            console.error(err);
            req.session.errorMessage = 'An error occurred. Please try again.';
            return res.redirect('/login');
        }
        if (!user) {
            req.session.errorMessage = 'Invalid username or password.';
            return res.redirect('/login');
        }
        req.session.user = user;
        res.redirect('/');
    });
});

// Route to handle user logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return console.log(err);
        }
        res.redirect('/');
    });
});

// Route to display the admin panel
app.get('/admin', ensureAdmin, (req, res) => {
    db.all('SELECT * FROM users', [], (err, users) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('An error occurred.');
        }
        db.all('SELECT * FROM logs', [], (err, actions) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('An error occurred.');
            }
            db.all('SELECT * FROM items', [], (err, items) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send('An error occurred.');
                }
                res.render('admin', { user: req.session.user, users, actions, items, SUPERADMIN_USERNAMES });
            });
        });
    });
});

// Route to display the profile page
app.get('/profile', ensureLoggedIn, (req, res) => {
    const userId = req.session.user.id;

    db.all('SELECT * FROM items WHERE creator = ?', [req.session.user.username], (err, userItems) => {
        if (err) {
            console.error(err);
            return res.sendStatus(500);
        }

        db.all('SELECT * FROM logs WHERE user = ?', [req.session.user.username], (err, userActions) => {
            if (err) {
                console.error(err);
                return res.sendStatus(500);
            }

            res.render('profile', { user: req.session.user, userItems, userActions });
        });
    });
});

// Route to handle editing username
app.post('/profile/edit', checkAuth, (req, res) => {
    const newUsername = req.body.username;
    const oldUsername = req.session.user.username;
    db.run("UPDATE users SET username = ? WHERE id = ?", [newUsername, req.session.user.id], (err) => {
        if (err) {
            return console.log(err.message);
        }
        db.run("UPDATE items SET creator = ? WHERE creator = ?", [newUsername, oldUsername], (err) => {
            if (err) {
                return console.log(err.message);
            }
            db.run("UPDATE logs SET user = ? WHERE user = ?", [newUsername, oldUsername], (err) => {
                if (err) {
                    return console.log(err.message);
                }
                req.session.user.username = newUsername;
                res.redirect('/profile');
            });
        });
    });
});

// Route to handle setting user as admin
app.post('/admin/setAdmin/:id', checkSuperAdmin, (req, res) => {
    const id = req.params.id;
    db.run("UPDATE users SET isAdmin = 1 WHERE id = ?", [id], function(err) {
        if (err) {
            return console.log(err.message);
        }
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
            if (err) {
                return console.log(err.message);
            }
            if (user) {
                logAction('setAdmin', req.session.user.username, `Set user "${user.username}" with ID "${id}" as admin`);
                // Refresh session data for the updated user
                if (req.session.user.username === user.username) {
                    req.session.user.isAdmin = true;
                }
            }
            res.redirect('/admin');
        });
    });
});

// Route to handle removing admin status
app.post('/admin/removeAdmin/:id', checkSuperAdmin, (req, res) => {
    const id = req.params.id;
    db.run("UPDATE users SET isAdmin = 0 WHERE id = ?", [id], function(err) {
        if (err) {
            console.log("Error updating user:", err.message);
            return res.send("Error updating user");
        }
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
            if (err) {
                console.log("Error fetching user:", err.message);
                return res.send("Error fetching user");
            }
            if (user) {
                logAction('removeAdmin', req.session.user.username, `Removed admin status from user "${user.username}" with ID "${id}"`);
                // Force logout if the current user's admin status is removed
                if (req.session.user.id === user.id) {
                    req.session.destroy((err) => {
                        if (err) {
                            return console.log(err);
                        }
                        res.redirect('/login');
                    });
                } else {
                    res.redirect('/admin');
                }
            } else {
                console.log("User not found");
                res.redirect('/admin');
            }
        });
    });
});

// Route to handle deleting a user
app.post('/admin/deleteUser/:id', checkSuperAdmin, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
        if (err) {
            console.log("Error fetching user:", err.message);
            return res.send("Error fetching user");
        }
        if (user) {
            db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
                if (err) {
                    console.log("Error deleting user:", err.message);
                    return res.send("Error deleting user");
                }
                logAction('deleteUser', req.session.user.username, `Deleted user "${user.username}" with ID "${id}"`);
                // Force logout if the current user's account is deleted
                if (req.session.user.id === user.id) {
                    req.session.destroy((err) => {
                        if (err) {
                            return console.log(err);
                        }
                        res.redirect('/login');
                    });
                } else {
                    res.redirect('/admin');
                }
            });
        } else {
            console.log("User not found");
            res.redirect('/admin');
        }
    });
});

// Route to handle adding a value from admin panel
app.post('/admin/add', checkAdmin, (req, res) => {
    const value = req.body.value;
    const id = uuidv4();
    const creator = req.session.user.username;
    db.run("INSERT INTO items (id, value, creator) VALUES (?, ?, ?)", [id, value, creator], (err) => {
        if (err) {
            return console.log(err.message);
        }
        logAction('adminAdd', req.session.user.username, `Admin added value "${value}" with ID "${id}"`);
        res.redirect('/admin');
    });
});

// Route to handle editing a value from admin panel
app.post('/admin/update/:id', checkAdmin, (req, res) => {
    const id = req.params.id;
    const newValue = req.body.value;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (err) {
            return console.log(err.message);
        }
        if (item) {
            db.run("UPDATE items SET value = ? WHERE id = ?", [newValue, id], (err) => {
                if (err) {
                    return console.log(err.message);
                }
                logAction('adminUpdate', req.session.user.username, `Admin updated value from "${item.value}" to "${newValue}" with ID "${id}"`);
                res.redirect('/admin');
            });
        } else {
            res.redirect('/admin');
        }
    });
});

// Route to handle removing a value from admin panel
app.post('/admin/remove/:id', checkAdmin, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (err) {
            return console.log(err.message);
        }
        if (item) {
            db.run("DELETE FROM items WHERE id = ?", [id], (err) => {
                if (err) {
                    return console.log(err.message);
                }
                logAction('adminRemove', req.session.user.username, `Admin removed value "${item.value}" with ID "${id}"`);
                res.redirect('/admin');
            });
        } else {
            res.redirect('/admin');
        }
    });
});

// Log action function
function logAction(action, username, details) {
    const timestamp = new Date().toISOString();
    const id = uuidv4();
    db.run("INSERT INTO logs (id, action, timestamp, details, user) VALUES (?, ?, ?, ?, ?)", [id, `${username} performed ${action}`, timestamp, details, username]);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});