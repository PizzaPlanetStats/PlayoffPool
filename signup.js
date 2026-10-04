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
        message.textContent = "You are a fool, team name must be 2 to 30 characters.";
        return;
    }
    if (!email || !code)
    {
        message.textContent = "You are a fool, fill in every box.";
        return;
    }
    if (password.length < 4)
    {
        message.textContent = "You are a fool, password must be at least 4 characters.";
        return;
    }
    if (password !== confirm)
    {
        message.textContent = "You are a fool, the passwords do not match.";
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
            message.textContent = "You are a fool, the league code is wrong.";
        }
        else if (err.code === "auth/email-already-in-use")
        {
            message.textContent = "You are a fool, that email already has an account.";
        }
        else if (err.code === "auth/invalid-email")
        {
            message.textContent = "You are a fool, that ain't no email.";
        }
        else if (err.code === "auth/network-request-failed")
        {
            message.textContent = "Network problem. Check your connection and regain.";
        }
        else
        {
            message.textContent = "Could not create the account. Regain.";
        }
    }

    submitButton.disabled = false;
});