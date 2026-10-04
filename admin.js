// Pizza Planet - admin login page

import { auth, isAdmin, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "./firebase.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorBox = document.getElementById("error");
const submitButton = document.getElementById("submit");

let signingIn = false;

// already logged in as admin? skip the form
onAuthStateChanged(auth, async function(user) {
    if (signingIn)
    {
        return;
    }

    if (user && await isAdmin(user))
    {
        location.replace("adminHome.html");
    }
});

form.addEventListener("submit", async function(event) {
    event.preventDefault();
    errorBox.textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password)
    {
        errorBox.textContent = "Enter your email and password.";
        return;
    }

    signingIn = true;
    submitButton.disabled = true;

    try
    {
        const result = await signInWithEmailAndPassword(auth, email, password);

        if (await isAdmin(result.user))
        {
            location.replace("adminHome.html");
            return;
        }

        // valid login, but not an admin account
        await signOut(auth);
        errorBox.textContent = "This account does not have admin access.";
    }
    catch (err)
    {
        if (err.code === "auth/too-many-requests")
        {
            errorBox.textContent = "Too many attempts. Wait a few minutes and try again.";
        }
        else if (err.code === "auth/network-request-failed")
        {
            errorBox.textContent = "Network problem. Check your connection and try again.";
        }
        else
        {
            errorBox.textContent = "Incorrect email or password.";
        }
    }

    signingIn = false;
    submitButton.disabled = false;
});