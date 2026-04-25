const express = require("express");

// Additional packages for handling authentication
const argon2 = require("argon2");
const fs = require("fs");
const session = require("express-session");

// Create the Express app
const app = express();

// Use the 'public' folder to serve static files
app.use(express.static("public"));

// Use the json middleware to parse JSON data
app.use(express.json());

// Use the session middleware to maintain sessions
const gameSession = session({
    secret: "game",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 300000 }
});
app.use(gameSession);

// This helper function checks whether the text only contains word characters
function containWordCharsOnly(text) {
    return /^\w+$/.test(text);
}

// Handle the /register endpoint
app.post("/register", async (req, res) => {
    //
    // C. Reading the json input
    //

    // Get the JSON data from the body
    const { username, avatar, name, password } = req.body;

    //
    // D. Reading the users.json file
    //

    // Add your code here
    const users = JSON.parse(fs.readFileSync("./data/users.json", "utf-8"));
    
    //
    // E. Checking for the user data correctness
    //
    
    // Add your code here
    if (username == "" || avatar == "" || name == "" || password == "") {
        res.json({ error: "Username/avatar/name/password cannot be empty." });
        return;
    } else if (!containWordCharsOnly(username)) {
        res.json({ error: "Username can only contain underscores, letters or numbers." });
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
    users[username] = { avatar, name, password: hash };

    //
    // H. Saving the users.json file
    //

    // Add your code here
    fs.writeFileSync("./data/users.json", JSON.stringify(users, null, 2));

    //
    // I. Sending a success response to the browser
    //
 
    res.json({ success: true });
});

// Handle the /signin endpoint
app.post("/signin", async (req, res) => {
    // Get the JSON data from the body
    const { username, password } = req.body;

    //
    // D. Reading the users.json file
    //

    // Add your code here
    const users = JSON.parse(fs.readFileSync("./data/users.json", "utf-8"));

    //
    // E. Checking for username/password
    //

    // Add your code here

    // REPLACE THIS CODE WITH YOUR CODE
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
        avatar: users[username].avatar,
        name: users[username].name
    }
 
    res.json({ user: req.session.user });
});

// Handle the /validate endpoint
app.get("/validate", (req, res) => {

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
});

// Handle the /signout endpoint
app.get("/signout", (req, res) => {

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
});

// Use a web server to listen at port 8000
app.listen(8000, () => {
    console.log("The game server has started...");
});
