const fs = require("fs");
const path = require("path");

const USERS_JSON_PATH = path.join(__dirname, "..", "data", "users.json");

/**
 * @typedef {Object} UserRecord
 * @property {string} name
 * @property {string} password
 */

function ensureUsersFile() {
	if (!fs.existsSync(USERS_JSON_PATH)) {
		fs.mkdirSync(path.dirname(USERS_JSON_PATH), { recursive: true });
		fs.writeFileSync(USERS_JSON_PATH, "{}", "utf-8");
	}
}

/**
 * @returns {Record<string, UserRecord>}
 */
function getUsers() {
	ensureUsersFile();
	const raw = fs.readFileSync(USERS_JSON_PATH, "utf-8").trim();
	if (raw === "") return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * @param {Record<string, UserRecord>} users
 */
function saveUsers(users) {
	ensureUsersFile();
	fs.writeFileSync(USERS_JSON_PATH, JSON.stringify(users, null, 2), "utf-8");
}

/**
 * @param {string} username
 * @returns {UserRecord | null}
 */
function getUserByUsername(username) {
	const users = getUsers();
	return users[username] ?? null;
}

/**
 * @param {string} username
 * @returns {boolean}
 */
function usernameExists(username) {
	const users = getUsers();
	return username in users;
}

/**
 * @param {string} username
 * @param {UserRecord} user
 */
function createUser(username, user) {
	const users = getUsers();
	users[username] = user;
	saveUsers(users);
}

module.exports = { getUsers, saveUsers, getUserByUsername, usernameExists, createUser };

