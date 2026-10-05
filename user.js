// Pizza Planet - team profile page (user.html?id=TEAM_ID)
// Anyone can view a team. Only the signed-in owner sees the account settings.
// Team names are user-typed, so they are only ever shown with textContent, never as HTML.

import { auth, onAuthStateChanged, signOut, getProfile, getPublicTeam, updateTeamName, validTeamName, changePassword } from "./team.js";
import { ACHIEVEMENTS } from "./achievements.js";

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
const achievementsArea = document.getElementById("achievements");

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

// a two-column grid of achievement boxes
function buildAchievementGrid(achievements, state)
{
    const grid = document.createElement("div");
    grid.className = "achievement-grid";

    achievements.forEach(function(achievement) {
        const achievementBox = document.createElement("div");
        achievementBox.className = "achievement " + state;

        const name = document.createElement("h4");
        name.textContent = achievement.name;

        const description = document.createElement("p");
        description.textContent = achievement.description;

        achievementBox.append(name, description);
        grid.appendChild(achievementBox);
    });

    return grid;
}

// unlocked achievements are always shown, the locked ones are in a dropdown that starts closed
function showAchievements(unlocked)
{
    achievementsArea.textContent = "";

    const unlockedAchievements = ACHIEVEMENTS.filter(function(achievement) {
        return unlocked.includes(achievement.id);
    });

    const lockedAchievements = ACHIEVEMENTS.filter(function(achievement) {
        return !unlocked.includes(achievement.id);
    });

    const unlockedTitle = document.createElement("h4");
    unlockedTitle.textContent = "Unlocked (" + unlockedAchievements.length + " of " + ACHIEVEMENTS.length + ")";
    achievementsArea.appendChild(unlockedTitle);

    if (unlockedAchievements.length > 0)
    {
        achievementsArea.appendChild(buildAchievementGrid(unlockedAchievements, "unlocked"));
    }
    else
    {
        const none = document.createElement("p");
        none.textContent = "No achievements unlocked yet.";
        achievementsArea.appendChild(none);
    }

    if (lockedAchievements.length > 0)
    {
        const lockedGroup = document.createElement("details");

        const lockedTitle = document.createElement("summary");
        lockedTitle.textContent = "Locked (" + lockedAchievements.length + ") - click to show";

        lockedGroup.append(lockedTitle, buildAchievementGrid(lockedAchievements, "locked"));
        achievementsArea.appendChild(lockedGroup);
    }
}

onAuthStateChanged(auth, async function(user) {
    // "My Team" with no id in the address needs a signed-in team
    if (!requestedId && !user)
    {
        location.replace("signin.html");
        return;
    }

    const teamId = requestedId || user.uid;
    const isOwner = Boolean(user) && user.uid === teamId;

    let profile;
    try
    {
        // the public copy of the team can be read by everyone
        profile = await getPublicTeam(teamId);

        // a team that is not on the public list yet can still be seen by its owner
        if (!profile && isOwner)
        {
            profile = await getProfile(teamId);
        }
    }
    catch (err)
    {
        status.textContent = "Could not load this team. Try again later.";
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

    const unlocked = Array.isArray(profile.achievements) ? profile.achievements : [];
    showAchievements(unlocked);

    status.classList.add("hidden");
    profileArea.classList.remove("hidden");

    // only the owner sees the account tools
    ownArea.classList.toggle("hidden", !isOwner);

    if (isOwner)
    {
        newName.value = profile.teamName;
    }
});

renameForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    message.classList.add("error");
    message.textContent = "";

    const name = newName.value.trim();

    if (!validTeamName(name))
    {
        message.textContent = "Team name must be 2 to 30 characters.";
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
        message.textContent = "Could not save the name. Try again.";
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
        pwMessage.textContent = "Fill in all three boxes.";
        return;
    }
    if (next.length < 8)
    {
        pwMessage.textContent = "New password must be at least 8 characters.";
        return;
    }
    if (next !== confirm)
    {
        pwMessage.textContent = "The new passwords do not match.";
        return;
    }
    if (next === current)
    {
        pwMessage.textContent = "The new password must be different from the current one.";
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
            pwMessage.textContent = "Your current password is wrong.";
        }
        else if (err.code === "auth/weak-password")
        {
            pwMessage.textContent = "Pick a stronger password.";
        }
        else if (err.code === "auth/too-many-requests")
        {
            pwMessage.textContent = "Too many attempts. Wait a few minutes and try again.";
        }
        else
        {
            pwMessage.textContent = "Could not change the password. Try again.";
        }
    }

    pwButton.disabled = false;
});

logoutButton.addEventListener("click", async function() {
    await signOut(auth);
    location.replace("signin.html");
});