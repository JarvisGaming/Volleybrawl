const argon2 = require("argon2");
const userModel = require("../models/user_model.js");

// This helper function checks whether the text only contains word characters
function containWordCharsOnly(text) {
    return /^\w+$/.test(text);
}

const USERNAME_MIN_LEN = 1;
const USERNAME_MAX_LEN = 20;
const DISPLAY_NAME_MIN_LEN = 1;
const DISPLAY_NAME_MAX_LEN = 20;
const PASSWORD_MIN_LEN = 1;
const PASSWORD_MAX_LEN = 64;

function isString(x) {
	return typeof x === "string";
}

function isWhitespaceOnly(s) {
	return /^\s+$/.test(s);
}

/**
 * Handle the /register endpoint.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function register(req, res) {
    //
    // C. Reading the json input
    //

    // Get the JSON data from the body
    const { username, name, password } = req.body;

    //
    // D. Reading the users.json file
    //

    // Add your code here
    const users = userModel.getUsers();
    
    //
    // E. Checking for the user data correctness
    //
    
    // Add your code here
    if (!isString(username) || !isString(name) || !isString(password)) {
        res.json({ error: "Invalid input type." });
        return;
    }

    if (username === "" || name === "" || password === "") {
        res.json({ error: "Username/name/password cannot be empty." });
        return;
    } else if (name !== "" && isWhitespaceOnly(name)) {
        res.json({ error: "Display name cannot be whitespace only." });
        return;
    } else if (username.length < USERNAME_MIN_LEN || username.length > USERNAME_MAX_LEN) {
        res.json({ error: `Username length must be ${USERNAME_MIN_LEN}-${USERNAME_MAX_LEN}.` });
        return;
    } else if (!containWordCharsOnly(username)) {
        res.json({ error: "Username can only contain underscores, letters or numbers." });
        return;
    } else if (name.length < DISPLAY_NAME_MIN_LEN || name.length > DISPLAY_NAME_MAX_LEN) {
        res.json({ error: `Display name length must be ${DISPLAY_NAME_MIN_LEN}-${DISPLAY_NAME_MAX_LEN}.` });
        return;
    } else if (password.length < PASSWORD_MIN_LEN || password.length > PASSWORD_MAX_LEN) {
        res.json({ error: `Password length must be ${PASSWORD_MIN_LEN}-${PASSWORD_MAX_LEN}.` });
        return;
    } else if (username in users) {
        res.json({ error: "Username has already been used." });
        return;
    }

    //
    // G. Adding the new user account
    //

    // Hash the password
    const hash = await argon2.hash(password);

    // Add your code here
    users[username] = { name, password: hash };

    //
    // H. Saving the users.json file
    //

    // Add your code here
    userModel.saveUsers(users);

    //
    // I. Sending a success response to the browser
    //
 
    res.json({ success: true });
}

/**
 * Handle the /signin endpoint.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function signin(req, res) {
    // Get the JSON data from the body
    const { username, password } = req.body;

    //
    // D. Reading the users.json file
    //

    // Add your code here
    const users = userModel.getUsers();

    //
    // E. Checking for username/password
    //

    // Add your code here

    // REPLACE THIS CODE WITH YOUR CODE
    if (!isString(username) || !isString(password)) {
        res.json({ error: "Invalid input type." });
        return;
    }

    if (username === "" || password === "") {
        res.json({ error: "Username/password cannot be empty." });
        return;
    }

    if (!(username in users)) {
        res.json({ error: "Incorrect username/password." });
        return;
    }
    const user = { password: users[username].password };

    // If password is incorrect, return an error
    const verified = await argon2.verify(user.password, password);
    if (!verified) {
        res.json({ error: "Incorrect username/password." });
        return;
    }

    //
    // G. Sending a success response with the user account
    //

    // Add your code here
    req.session.user = {
        username,
        name: users[username].name
    }
 
    res.json({ user: req.session.user });
}

/**
 * Handle the /validate endpoint.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function validate(req, res) {
    //
    // B. Getting req.session.user
    //

    // Add your code here
    const user = req.session.user;
    if (!user) {
        res.json({ error: "Session user does not exist." });
        return;
    }

    //
    // D. Sending a success response with the user account
    //

    res.json({ user: req.session.user });
}

/**
 * Handle the /signout endpoint.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function signout(req, res) {
    //
    // Deleting req.session.user
    //

    // Delete the session information
    if (req.session.user) {
        delete req.session.user;
    }

    //
    // Sending a success response
    //

    res.json({ success: true });
}

module.exports = { register, signin, validate, signout };
