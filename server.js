const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const session = require('express-session');
const db = require('./database');
const app = express();
const path = require('path');
const port = 3000;

const SUPERADMIN_USERNAMES = ['law']; // Hardcoded superadmin usernames

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

let selectedId = null;

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Middleware to check if user is admin
function checkAdmin(req, res, next) {
    if (req.session.user && (req.session.user.isAdmin || SUPERADMIN_USERNAMES.includes(req.session.user.username))) {
        next();
    } else {
        res.redirect('/');
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

// Route to display the form and stored values with filtering
app.get('/', (req, res) => {
    let sql = "SELECT * FROM items";
    let params = [];
    const filterUser = req.query['filter-user'];
    const filterDate = req.query['filter-date'];

    if (filterUser) {
        sql += " WHERE creator = ?";
        params.push(filterUser);
    }

    if (filterDate) {
        if (params.length) {
            sql += " AND DATE(timestamp) = DATE(?)";
        } else {
            sql += " WHERE DATE(timestamp) = DATE(?)";
        }
        params.push(filterDate);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            throw err;
        }
        res.render('index', { items: rows, selectedId, user: req.session.user });
    });
});

// Route to handle form submission
app.post('/add', checkAuth, (req, res) => {
    const value = req.body.value;
    const id = uuidv4();
    const creator = req.session.user.username;
    db.run("INSERT INTO items (id, value, creator) VALUES (?, ?, ?)", [id, value, creator], (err) => {
        if (err) {
            return console.log(err.message);
        }
        logAction('add', req.session.user.username, `Added value "${value}" with ID "${id}"`);
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

// Route to handle selecting an item
app.post('/select/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (err) {
            return console.log(err.message);
        }
        if (item && (item.creator === req.session.user.username || req.session.user.isAdmin || SUPERADMIN_USERNAMES.includes(req.session.user.username))) {
            selectedId = id;
        }
        res.redirect('/');
    });
});

// Route to handle unselecting an item
app.post('/unselect', checkAuth, (req, res) => {
    selectedId = null;
    res.redirect('/');
});

// Route to handle updating an item
app.post('/update/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    const newValue = req.body.value;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (err) {
            return console.log(err.message);
        }
        if (item && (item.creator === req.session.user.username || req.session.user.isAdmin || SUPERADMIN_USERNAMES.includes(req.session.user.username))) {
            db.run("UPDATE items SET value = ? WHERE id = ?", [newValue, id], (err) => {
                if (err) {
                    return console.log(err.message);
                }
                selectedId = null;
                logAction('update', req.session.user.username, `Updated value from "${item.value}" to "${newValue}" with ID "${id}"`);
                res.redirect('/');
            });
        } else {
            res.redirect('/');
        }
    });
});

// Route to display the registration page
app.get('/register', (req, res) => {
    res.render('register');
});

// Route to handle user registration
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const isAdmin = SUPERADMIN_USERNAMES.includes(username) ? 1 : 0;
    db.run("INSERT INTO users (id, username, password, isAdmin) VALUES (?, ?, ?, ?)", [id, username, hashedPassword, isAdmin], (err) => {
        if (err) {
            return console.log(err.message);
        }
        logAction('register', username, `Registered user "${username}" with ID "${id}"`);
        res.redirect('/login');
    });
});

// Route to display the login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Route to handle user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) {
            return console.log(err.message);
        }
        if (user && await bcrypt.compare(password, user.password)) {
            if (SUPERADMIN_USERNAMES.includes(user.username)) {
                user.isAdmin = true;
            }
            req.session.user = user;
            res.redirect('/');
        } else {
            res.send('Invalid username or password');
        }
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
app.get('/admin', checkAdmin, (req, res) => {
    db.all("SELECT * FROM users", [], (err, users) => {
        if (err) {
            throw err;
        }
        db.all("SELECT * FROM items", [], (err, items) => {
            if (err) {
                throw err;
            }
            db.all("SELECT * FROM logs", [], (err, logs) => {
                if (err) {
                    throw err;
                }
                res.render('admin', { users, logs, items, user: req.session.user, SUPERADMIN_USERNAMES });
            });
        });
    });
});

// Route to display the profile page
app.get('/profile', checkAuth, (req, res) => {
    db.all("SELECT * FROM items WHERE creator = ?", [req.session.user.username], (err, items) => {
        if (err) {
            throw err;
        }
        db.all("SELECT * FROM logs WHERE action LIKE ?", [`%${req.session.user.username}%`], (err, logs) => {
            if (err) {
                throw err;
            }
            res.render('profile', { user: req.session.user, items, logs });
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
            db.run("UPDATE logs SET action = REPLACE(action, ?, ?) WHERE action LIKE ?", [oldUsername, newUsername, `%${oldUsername}%`], (err) => {
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
    db.run("UPDATE users SET isAdmin = 1 WHERE id = ?", [id], (err) => {
        if (err) {
            return console.log(err.message);
        }
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
            if (err) {
                return console.log(err.message);
            }
            logAction('setAdmin', req.session.user.username, `Set user "${user.username}" with ID "${id}" as admin`);
            res.redirect('/admin');
        });
    });
});

// Route to handle removing admin status
app.post('/admin/removeAdmin/:id', checkSuperAdmin, (req, res) => {
    const id = req.params.id;
    console.log(`Attempting to remove admin status from user with ID: ${id}`);
    db.run("UPDATE users SET isAdmin = 0 WHERE id = ?", [id], function(err) {
        if (err) {
            console.log("Error updating user:", err.message);
            return res.send("Error updating user");
        }
        console.log(`Updated ${this.changes} user(s)`);
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
            if (err) {
                console.log("Error fetching user:", err.message);
                return res.send("Error fetching user");
            }
            if (user) {
                console.log(`User ${user.username} isAdmin: ${user.isAdmin}`);
                logAction('removeAdmin', req.session.user.username, `Removed admin status from user "${user.username}" with ID "${id}"`);
            } else {
                console.log("User not found");
            }
            res.redirect('/admin');
        });
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
    db.run("INSERT INTO logs (id, action, timestamp, details) VALUES (?, ?, ?, ?)", [id, `${username} performed ${action}`, timestamp, details]);
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
