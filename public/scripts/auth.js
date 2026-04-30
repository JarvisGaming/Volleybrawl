function showSignedIn(user) {
	$("#signed-out").hide();
	$("#signed-in").show();
	$("#whoami").text(user?.name || user?.username || "");
	$("#auth-status").text("");
}

function showSignedOut() {
	$("#signed-in").hide();
	$("#signed-out").show();
	$("#whoami").text("");
}

async function postJSON(url, data) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		return { error: "Server returned invalid response." };
	}
}

async function getJSON(url) {
	const res = await fetch(url);
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		return { error: "Server returned invalid response." };
	}
}

$(async function () {
	const bootUser = (() => {
		try {
			const raw = document.body?.dataset?.bootstrapUser || "";
			return raw ? JSON.parse(decodeURIComponent(raw)) : null;
		} catch {
			return null;
		}
	})();
	if (bootUser) showSignedIn(bootUser);
	else showSignedOut();

	// Extra safety: validate session on load
	try {
		const result = await getJSON("/validate");
		if (result?.user) showSignedIn(result.user);
		else showSignedOut();
	} catch {
		// ignore
	}

	$("#register-form").on("submit", async function (e) {
		e.preventDefault();
		$("#register-message").text("");

		const payload = {
			username: $("#reg-username").val(),
			name: $("#reg-name").val(),
			password: $("#reg-password").val(),
		};

		try {
			const result = await postJSON("/register", payload);
			if (result?.success) {
				$("#register-message").text("Registered. You can sign in now.");
			} else {
				$("#register-message").text(result?.error || "Registration failed.");
			}
		} catch {
			$("#register-message").text("Network error. Please try again.");
		}
	});

	$("#signin-form").on("submit", async function (e) {
		e.preventDefault();
		$("#signin-message").text("");

		const payload = {
			username: $("#signin-username").val(),
			password: $("#signin-password").val(),
		};

		try {
			const result = await postJSON("/signin", payload);
			if (result?.user) {
				showSignedIn(result.user);
				// Persist for play page socket usage if needed
				sessionStorage.setItem("playerName", result.user.name || result.user.username);
			} else {
				$("#signin-message").text(result?.error || "Sign in failed.");
			}
		} catch {
			$("#signin-message").text("Network error. Please try again.");
		}
	});

	$("#signout-button").on("click", async function () {
		await getJSON("/signout");
		showSignedOut();
	});

	$("#play-button").on("click", function () {
		window.location.href = "/play";
	});
});

