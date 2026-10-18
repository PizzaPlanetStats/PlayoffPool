// Pizza Planet - sign up page

import { signUpTeam, validTeamName } from "./team.js";

const form = document.getElementById("signup-form");
const message = document.getElementById("message");
const submitButton = document.getElementById("submit");

form.addEventListener("submit", async function(event) {
    event.preventDefault();
    message.textContent = "";

    const teamName = document.getElementById("team").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const code = document.getElementById("code").value.trim();

    if (!validTeamName(teamName))
    {
        message.textContent = "Team name must be 2 to 30 characters.";
        return;
    }
    if (!email || !code)
    {
        message.textContent = "Fill in every box.";
        return;
    }
    if (password.length < 8)
    {
        message.textContent = "Password must be at least 8 characters.";
        return;
    }
    if (password !== confirm)
    {
        message.textContent = "The passwords do not match.";
        return;
    }

    submitButton.disabled = true;

    try
    {
        const user = await signUpTeam(teamName, email, password, code);
        location.replace("user.html?id=" + encodeURIComponent(user.uid));
        return;
    }
    catch (err)
    {
        if (err.code === "app/bad-league-code")
        {
            message.textContent = "That registration code is not right.";
        }
        else if (err.code === "auth/email-already-in-use")
        {
            message.textContent = "That email already has an account. Try signing in.";
        }
        else if (err.code === "auth/invalid-email")
        {
            message.textContent = "That email address does not look right.";
        }
        else if (err.code === "auth/weak-password")
        {
            message.textContent = "Pick a stronger password.";
        }
        else if (err.code === "auth/network-request-failed")
        {
            message.textContent = "Network problem. Check your connection and try again.";
        }
        else
        {
            message.textContent = "Could not create the account. Try again.";
        }
    }

    submitButton.disabled = false;
});