// scripts/hashPassword.js
const bcrypt = require('bcryptjs');
const plainPassword = 'yourChosenAdminPassword'; // Change this

bcrypt.hash(plainPassword, 10, function(err, hash) {
    if (err) {
        console.error('Error hashing password:', err);
    } else {
        console.log('Hashed Password:', hash);
        // Now you can use this hash to manually insert/update an admin user in your DB
    }
});