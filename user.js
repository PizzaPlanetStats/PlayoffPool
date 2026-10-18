// Pizza Planet - team profile page (user.html?id=TEAM_ID)
// Anyone can view a team. Only the signed-in owner sees the account settings.
// Team names are user-typed, so they are only ever shown with textContent, never as HTML.

import { auth, onAuthStateChanged, signOut, getProfile, getPublicTeam, updateTeamName, validTeamName, changePassword, updateSuffix } from "./team.js";
import { ACHIEVEMENTS } from "./achievements.js";
import { loadSeasons, computeStats } from "./userStats.js";
import { formatPoints } from "./standings.js";
import { drawHistoryChart } from "./historyChart.js";
import { appendSuffix, suffixOptions, suffixLabel } from "./suffixes.js";

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
const leaguesStatus = document.getElementById("leagues-status");
const leaguesScroll = document.getElementById("leagues-scroll");
const leaguesBody = document.getElementById("leagues-body");
const statsBox = document.getElementById("stats-box");
const summaryStats = document.getElementById("summary-stats");
const pointsStats = document.getElementById("points-stats");
const historyChart = document.getElementById("history-chart");
const suffixForm = document.getElementById("suffix-form");
const suffixSelect = document.getElementById("suffix-select");
const suffixMessage = document.getElementById("suffix-message");

let currentName = "";
let currentSuffix = "";

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

// the table of leagues, and the Stats box (both come from the saved final standings of ended leagues)
async function showHistory(teamId)
{
    let seasons;

    try
    {
        seasons = await loadSeasons(teamId);
    }
    catch (err)
    {
        leaguesStatus.textContent = "Could not load the leagues. Try again later.";
        return [];
    }

    if (seasons.length === 0)
    {
        leaguesStatus.textContent = "No leagues played yet.";
        return seasons;
    }

    leaguesScroll.classList.remove("hidden");

    seasons.forEach(function(season) {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        const link = document.createElement("a");
        link.href = "leagueTeam.html?id=" + encodeURIComponent(season.leagueId) + "&team=" + encodeURIComponent(teamId);
        link.textContent = season.leagueName;
        nameCell.appendChild(link);
        row.appendChild(nameCell);

        if (season.place >= 1 && season.place <= 3)
        {
            row.className = "place-" + season.place;
        }

        [season.place, season.total].forEach(function(value, index) {
            const cell = document.createElement("td");
            cell.className = "num";
            cell.textContent = index === 0 ? String(value) : formatPoints(value);
            row.appendChild(cell);
        });

        leaguesBody.appendChild(row);
    });

    const stats = computeStats(seasons);

    summaryStats.appendChild(buildTable(null, [
        ["Leagues Played", String(stats.leagues)],
        ["League Wins", String(stats.first)],
        ["Win Rate", formatPoints(stats.winRate) + "%"],
        ["Podiums (1st / 2nd / 3rd)", stats.first + " / " + stats.second + " / " + stats.third],
        ["Podium Points", String(stats.podiumPoints)],
        ["Average Finish", formatPoints(stats.averageFinish)],
        ["Best Finish", String(stats.bestFinish)]
    ], "General Stats"));

    const labels = { total: "Points", playerPoints: "Player Points", goaliePoints: "Goalie Points", teamPoints: "Team Points" };

    pointsStats.appendChild(buildTable(["Category", "All Time", "Average", "Best Result"], stats.kinds.map(function(kind) {
        return [labels[kind.key], formatPoints(kind.sum), formatPoints(kind.average), formatPoints(kind.best)];
    })));

    statsBox.classList.remove("hidden");
    drawHistoryChart(historyChart, seasons);

    return seasons;
}

// the team name with its suffix after it
function showName()
{
    teamHeading.textContent = currentName;
    appendSuffix(teamHeading, currentSuffix);
}

// the dropdown in Account Settings: none, plus every suffix the team has earned
function fillSuffixChoices(unlocked, seasons)
{
    suffixSelect.textContent = "";

    const none = document.createElement("option");
    none.value = "";
    none.textContent = "None";
    suffixSelect.appendChild(none);

    const options = suffixOptions(unlocked, seasons);

    // keep what is already chosen in the list even if it can't be worked out any more
    if (currentSuffix !== "" && suffixLabel(currentSuffix) !== "" && !options.some(function(option) { return option.key === currentSuffix; }))
    {
        options.push({ key: currentSuffix, label: suffixLabel(currentSuffix) });
    }

    options.forEach(function(option) {
        const element = document.createElement("option");
        element.value = option.key;
        element.textContent = option.label;
        suffixSelect.appendChild(element);
    });

    suffixSelect.value = currentSuffix;
}

// a small table. head = list of column titles or null, rows = lists of text (the first column is the row title),
// title = a heading that stretches across all the columns (optional)
function buildTable(head, rows, title)
{
    const table = document.createElement("table");
    table.className = "stats user-table stat-table";

    if (title)
    {
        const titleCell = document.createElement("th");
        titleCell.colSpan = rows[0].length;
        titleCell.textContent = title;

        const titleRow = document.createElement("tr");
        titleRow.appendChild(titleCell);

        const titleHead = document.createElement("thead");
        titleHead.appendChild(titleRow);
        table.appendChild(titleHead);
    }

    if (head)
    {
        const headRow = document.createElement("tr");

        head.forEach(function(title, index) {
            const cell = document.createElement("th");
            cell.textContent = title;
            cell.className = index > 0 ? "num" : "";
            headRow.appendChild(cell);
        });

        const thead = document.createElement("thead");
        thead.appendChild(headRow);
        table.appendChild(thead);
    }

    const body = document.createElement("tbody");

    rows.forEach(function(values) {
        const row = document.createElement("tr");

        values.forEach(function(text, index) {
            const cell = document.createElement("td");
            cell.textContent = text;
            cell.className = index > 0 ? "num" : "";
            row.appendChild(cell);
        });

        body.appendChild(row);
    });

    table.appendChild(body);

    return table;
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

    currentName = profile.teamName;
    currentSuffix = typeof profile.suffix === "string" ? profile.suffix : "";
    showName();
    document.title = profile.teamName + " - Pizza Planet";
    showTeamLogo(teamId, profile.teamName);

    const unlocked = Array.isArray(profile.achievements) ? profile.achievements : [];
    showAchievements(unlocked);

    status.classList.add("hidden");
    profileArea.classList.remove("hidden");
    showHistory(teamId).then(function(seasons) {
        if (isOwner)
        {
            fillSuffixChoices(unlocked, seasons);
        }
    });

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
        message.textContent = "You are a fool, team name must be 2 to 30 characters.";
        return;
    }

    try
    {
        await updateTeamName(auth.currentUser.uid, name);
        currentName = name;
        showName();
        teamLogo.alt = name + " logo";
        document.title = name + " - Pizza Planet";
        message.classList.remove("error");
        message.textContent = "Saved.";
    }
    catch (err)
    {
        message.textContent = "Could not save the name. Regain";
    }
});

suffixForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    suffixMessage.classList.add("error");
    suffixMessage.textContent = "";

    try
    {
        await updateSuffix(auth.currentUser.uid, suffixSelect.value);
        currentSuffix = suffixSelect.value;
        showName();
        suffixMessage.classList.remove("error");
        suffixMessage.textContent = "Saved.";
    }
    catch (err)
    {
        suffixMessage.textContent = err.code === "permission-denied"
            ? "Firebase refused to save. Check that the new rules are published."
            : "Could not save the suffix. Try again.";
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
        pwMessage.textContent = "You are a fool, fill in all three boxes.";
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
            pwMessage.textContent = "You are a fool, that password is WEAK.";
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