const db = require('../public/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const SUPERADMIN_USERNAMES = ['law']; // Replace with actual superadmin usernames

exports.register = (req, res) => {
    const { username, password } = req.body;
    const userId = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const timeReg = new Date().toISOString();
    const isAdmin = SUPERADMIN_USERNAMES.includes(username) ? 1 : 0;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
        if (err) {
            console.error('Error checking existing user:', err);
            req.session.errorMessage = 'An error occurred while registering. Please try again.';
            logAction('register_error', err.message, username, userId);
            return res.redirect('/register');
        }

        if (existingUser) {
            req.session.errorMessage = 'Username is already taken.';
            logAction('register_fail', 'Username taken', username, userId);
            return res.redirect('/register');
        }

        db.run("INSERT INTO users (id, username, password, isAdmin, timeReg) VALUES (?, ?, ?, ?, ?)", 
            [userId, username, hashedPassword, isAdmin, timeReg], (err) => {
            if (err) {
                console.error('Error registering user:', err);
                req.session.errorMessage = 'Error registering user';
                logAction('register_error', err.message, username, userId);
                return res.redirect('/register');
            }
            logAction('register_success', 'User registered successfully', username, userId);
            res.redirect('/login');
        });
    });
};

exports.login = (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            req.session.errorMessage = 'An error occurred, please try again.';
            logAction('login_error', err.message, username);
            return res.redirect('/login');
        }

        if (!user || !bcrypt.compareSync(password, user.password)) {
            req.session.errorMessage = 'Invalid username or password.';
            logAction('login_fail', 'Invalid credentials', username);
            return res.redirect('/login');
        }

        req.session.user = user;
        logAction('login_success', 'User logged in successfully', username, user.id);
        res.redirect('/');
    });
};

exports.logout = (req, res) => {
    const username = req.session.user.username;
    const userId = req.session.user.id;

    req.session.destroy((err) => {
        if (err) {
            console.error('Error logging out:', err);
            logAction('logout_error', err.message, username, userId);
        } else {
            logAction('logout_success', 'User logged out successfully', username, userId);
        }
        res.redirect('/login');
    });
};

exports.ensureLoggedIn = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

exports.ensureAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.redirect('/login');
    }
    next();
};

exports.loginPage = (req, res) => {
    res.render('login', { errorMessage: req.session.errorMessage, user: req.session.user });
    delete req.session.errorMessage;
};

exports.registerPage = (req, res) => {
    res.render('register', { errorMessage: req.session.errorMessage, user: req.session.user });
    delete req.session.errorMessage;
};

exports.ensureSuperAdmin = (req, res, next) => {
    if (!req.session.user || !SUPERADMIN_USERNAMES.includes(req.session.user.username)) {
        return res.redirect('/login');
    }
    next();
};

function logAction(action, details, username, userId = null) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const logDetails = [id, action, timestamp, details, username, userId];

    db.run("INSERT INTO logs (id, action, timestamp, details, user, userId) VALUES (?, ?, ?, ?, ?, ?)", logDetails, (err) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}


