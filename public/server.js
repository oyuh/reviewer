const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const timestamp = new Date().toISOString();

const app = express();
const PORT = process.env.PORT || 3000;

// Controllers
const authController = require('../controllers/authController');
const itemController = require('../controllers/itemController');
const logController = require('../controllers/logController');
const adminController = require('../controllers/adminController');
const profileController = require('../controllers/profileController');
const { timeStamp } = require('console');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Routes
app.get('/login', authController.loginPage);
app.post('/login', authController.login);
app.get('/logout', authController.logout);
app.get('/register', authController.registerPage);
app.post('/register', authController.register);

app.get('/', authController.ensureLoggedIn, itemController.getItems);
app.post('/add', authController.ensureLoggedIn, itemController.addItem);
app.post('/update/:id', authController.ensureLoggedIn, itemController.updateItem);
app.post('/remove/:id', authController.ensureLoggedIn, itemController.removeItem);
app.post('/like/:id', authController.ensureLoggedIn, itemController.likeItem);
app.post('/unlike/:id', authController.ensureLoggedIn, itemController.unlikeItem);

app.get('/profile', authController.ensureLoggedIn, profileController.getProfile);
app.get('/profile/:username', authController.ensureLoggedIn, profileController.getProfile);
app.post('/profile/editPost', authController.ensureLoggedIn, profileController.editPost);

app.get('/admin', authController.ensureAdmin, adminController.getAdminPage);
app.post('/admin/update-username', authController.ensureAdmin, adminController.updateUsername);
app.post('/admin/remove-user', authController.ensureAdmin, adminController.removeUser);
app.post('/admin/editPost', authController.ensureAdmin, adminController.editPost);
app.post('/admin/removePost', authController.ensureAdmin, adminController.removePost);


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} at ${timestamp}...`);
});
