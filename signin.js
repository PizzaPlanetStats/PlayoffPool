// Pizza Planet - sign in page

import { auth, onAuthStateChanged, signInTeam, getProfile, sendPasswordResetEmail } from "./team.js";

const form = document.getElementById("signin-form");
const message = document.getElementById("message");
const submitButton = document.getElementById("submit");
const forgot = document.getElementById("forgot");

let signingIn = false;

// already signed in with a team? go straight to the profile
onAuthStateChanged(auth, async function(user) {
    if (signingIn || !user)
    {
        return;
    }

    try
    {
        if (await getProfile(user.uid))
        {
            location.replace("user.html?id=" + encodeURIComponent(user.uid));
        }
    }
    catch (err)
    {
        // not a team account (for example the admin), stay on this page
    }
});

form.addEventListener("submit", async function(event) {
    event.preventDefault();
    message.classList.add("error");
    message.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password)
    {
        message.textContent = "You are a fool, enter your email and password.";
        return;
    }

    signingIn = true;
    submitButton.disabled = true;

    try
    {
        const user = await signInTeam(email, password);
        location.replace("user.html?id=" + encodeURIComponent(user.uid));
        return;
    }
    catch (err)
    {
        if (err.code === "app/no-profile")
        {
            message.textContent = "You are a fool, no team is set up for this account. Sign up first and regain.";
        }
        else if (err.code === "auth/too-many-requests")
        {
            message.textContent = "You are a fool, too many attempts. Wait a few minutes and regain.";
        }
        else if (err.code === "auth/network-request-failed")
        {
            message.textContent = "Network problem. Check your connection and regain.";
        }
        else
        {
            message.textContent = "You are a fool, incorrect email or password.";
        }
    }

    signingIn = false;
    submitButton.disabled = false;
});

forgot.addEventListener("click", async function(event) {
    event.preventDefault();
    message.classList.add("error");
    message.textContent = "";

    const email = document.getElementById("email").value.trim();

    if (!email)
    {
        message.textContent = "Type your email in the box above first.";
        return;
    }

    try
    {
        await sendPasswordResetEmail(auth, email);
    }
    catch (err)
    {
        // same message either way, so nobody can use this to check which emails have accounts
    }

    message.classList.remove("error");
    message.textContent = "An email has been sent. Make sure to check your spam folder.";
});