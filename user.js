// Pizza Planet - team profile page (user.html?id=TEAM_ID)
// Team names are user-typed, so they are only ever shown with textContent, never as HTML.

import { auth, onAuthStateChanged, signOut, getProfile, updateTeamName, validTeamName, changePassword } from "./team.js";

const status = document.getElementById("status");
const profileArea = document.getElementById("profile");
const teamHeading = document.getElementById("team-name");
const teamLogo = document.getElementById("team-logo");
const ownArea = document.getElementById("own-area");
const renameForm = document.getElementById("rename-form");
const newName = document.getElementById("new-name");
const message = document.getElementById("message");
const pwForm = document.getElementById("pw-form");
const pwMessage = document.getElementById("pw-message");
const pwButton = document.getElementById("change-pw");
const logoutButton = document.getElementById("logout");

const requestedId = new URLSearchParams(location.search).get("id");

// team logos are PNG files in the project root named TEAMID.png
// no file = no logo shown
function showTeamLogo(teamId, teamName)
{
    teamLogo.addEventListener("load", function() {
        teamLogo.classList.remove("hidden");
    });
    teamLogo.addEventListener("error", function() {
        teamLogo.classList.add("hidden");
    });
    teamLogo.alt = teamName + " logo";
    teamLogo.src = encodeURIComponent(teamId) + ".png";
}

onAuthStateChanged(auth, async function(user) {
    if (!user)
    {
        location.replace("signin.html");
        return;
    }

    const teamId = requestedId || user.uid;

    let profile;
    try
    {
        profile = await getProfile(teamId);
    }
    catch (err)
    {
        status.textContent = "You need a team account to view this page.";
        return;
    }

    if (!profile)
    {
        status.textContent = "Team not found.";
        return;
    }

    teamHeading.textContent = profile.teamName;
    document.title = profile.teamName + " - Pizza Planet";
    showTeamLogo(teamId, profile.teamName);
    status.classList.add("hidden");
    profileArea.classList.remove("hidden");

    // only the owner sees the account tools
    if (user.uid === teamId)
    {
        newName.value = profile.teamName;
        ownArea.classList.remove("hidden");
    }
});

renameForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    message.classList.add("error");
    message.textContent = "";

    const name = newName.value.trim();

    if (!validTeamName(name))
    {
        message.textContent = "You are a fool, team name must be 2 to 30 characters.";
        return;
    }

    try
    {
        await updateTeamName(auth.currentUser.uid, name);
        teamHeading.textContent = name;
        teamLogo.alt = name + " logo";
        document.title = name + " - Pizza Planet";
        message.classList.remove("error");
        message.textContent = "Saved.";
    }
    catch (err)
    {
        message.textContent = "Could not save the name. Regain.";
    }
});

pwForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    pwMessage.classList.add("error");
    pwMessage.textContent = "";

    const current = document.getElementById("current-password").value;
    const next = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;

    if (!current || !next || !confirm)
    {
        pwMessage.textContent = "You are a fool, fill in all 3 boxes.";
        return;
    }
    if (next.length < 4)
    {
        pwMessage.textContent = "You are a fool, new password must be at least 4 characters.";
        return;
    }
    if (next !== confirm)
    {
        pwMessage.textContent = "You are a fool, the new passwords do not match.";
        return;
    }
    if (next === current)
    {
        pwMessage.textContent = "You are a fool, the new password must be different from the current one.";
        return;
    }

    pwButton.disabled = true;

    try
    {
        await changePassword(current, next);
        pwForm.reset();
        pwMessage.classList.remove("error");
        pwMessage.textContent = "Password changed.";
    }
    catch (err)
    {
        if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential")
        {
            pwMessage.textContent = "You are a fool, your current password is wrong.";
        }
        else if (err.code === "auth/weak-password")
        {
            pwMessage.textContent = "You are a fool, that password SUCKS";
        }
        else if (err.code === "auth/too-many-requests")
        {
            pwMessage.textContent = "You are a fool, too many attempts. Wait a few minutes and regain.";
        }
        else
        {
            pwMessage.textContent = "Could not change the password. Regain.";
        }
    }

    pwButton.disabled = false;
});

logoutButton.addEventListener("click", async function() {
    await signOut(auth);
    location.replace("signin.html");
});