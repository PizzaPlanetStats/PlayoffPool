// Pizza Planet - league home page (league.html?id=LEAGUE_ID)
// Anyone can view this page. League names are typed in by the admin,
// so everything is shown with textContent, never as HTML.

import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, onAuthStateChanged } from "./team.js";
import { loadStandings } from "./leagueStandings.js";
import { formatPoints } from "./standings.js";
import { appendSuffix } from "./suffixes.js";
import { SKATER_STATS, GOALIE_STATS } from "./stats.js";
import { renderBracket } from "./bracket.js";
import { phaseInfo, leaguePhase } from "./phases.js";
import { exportLeague } from "./exportLeague.js";
import { pickedPlayers, makePickBoard } from "./leaguePicks.js";
import { PREDICTION_POINTS, ONE_ROUND_OFF_RULE } from "./predictions.js";

const status = document.getElementById("status");
const leagueArea = document.getElementById("league");
const leagueName = document.getElementById("league-name");
const registrationText = document.getElementById("registration-text");
const signupPlaceholder = document.getElementById("signup-placeholder");
const standingsStatus = document.getElementById("standings-status");
const standingsBox = document.getElementById("standings");

let currentUser = null;
let phase = "created";
let standingsRows = null;   // the ranked teams, once they have loaded (only after the league has started)

const leagueId = new URLSearchParams(location.search).get("id");

loadLeague();

async function loadLeague()
{
    if (!leagueId || !/^[A-Za-z0-9]{1,40}$/.test(leagueId))
    {
        status.textContent = "League not found.";
        return;
    }

    let data;

    try
    {
        const snap = await getDoc(doc(db, "leagues", leagueId));

        if (!snap.exists())
        {
            status.textContent = "League not found.";
            return;
        }

        data = snap.data();
    }
    catch (err)
    {
        status.textContent = "Could not load this league. Try again later.";
        return;
    }

    // leagues made before names existed show their year as the name
    const name = String(data.name || (data.year + " League"));

    leagueName.textContent = name;
    document.title = name + " - Pizza Planet";

    phase = leaguePhase(data);
    renderPhase(phase);
    startStandings(data);

    const scoring = data.scoring || {};
    renderRules(document.getElementById("skater-rules"), SKATER_STATS, scoring.skaters || {}, "No player stats are tracked.");
    renderRules(document.getElementById("goalie-rules"), GOALIE_STATS, scoring.goalies || {}, "No goalie stats are tracked.");

    renderPredictionRules(document.getElementById("prediction-rules"), data.predictionPoints);

    renderBracket(document.getElementById("playoff-teams"), data.playoffTeams, {
        winners: data.results ? data.results.winners : []
    });

    status.classList.add("hidden");
    leagueArea.classList.remove("hidden");
}

// what phase the league is in. Joining is only offered while registration is open.
function renderPhase(phase)
{
    registrationText.textContent = phaseInfo(phase).message;

    if (phase === "open")
    {
        // the Register button replaces any placeholder text
        signupPlaceholder.textContent = "";

        const register = document.createElement("a");
        register.id = "register-button";
        register.className = "btn";
        register.href = "register.html?id=" + encodeURIComponent(leagueId);
        register.textContent = "Register";

        signupPlaceholder.appendChild(register);
        signupPlaceholder.classList.remove("hidden");
    }
}

// a table of the stats this league scores and what each one is worth
function renderRules(container, statList, values, emptyText)
{
    const tracked = statList.filter(function(stat) {
        return Object.prototype.hasOwnProperty.call(values, stat.key);
    });

    if (tracked.length === 0)
    {
        const none = document.createElement("p");
        none.textContent = emptyText;
        container.appendChild(none);
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "scroll";

    const table = document.createElement("table");
    table.className = "stats";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Stat", "Points each"].forEach(function(title) {
        const th = document.createElement("th");
        th.textContent = title;
        headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    tracked.forEach(function(stat) {
        const row = document.createElement("tr");

        const statCell = document.createElement("td");
        statCell.textContent = stat.label;

        const pointsCell = document.createElement("td");
        pointsCell.textContent = values[stat.key];

        row.append(statCell, pointsCell);
        body.appendChild(row);
    });
    table.appendChild(body);

    wrapper.appendChild(table);
    container.appendChild(wrapper);
}

// what each correct prediction is worth. Leagues made before this was a setting use the standard points.
function renderPredictionRules(container, saved)
{
    if (!container)
    {
        return;
    }

    container.textContent = "";

    const wrapper = document.createElement("div");
    wrapper.className = "scroll";

    const table = document.createElement("table");
    table.className = "stats";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Correct prediction", "Points"].forEach(function(title) {
        const th = document.createElement("th");
        th.textContent = title;
        headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");

    PREDICTION_POINTS.forEach(function(prediction) {
        const value = saved ? saved[prediction.key] : undefined;

        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = prediction.label;

        const pointsCell = document.createElement("td");
        pointsCell.textContent = typeof value === "number" ? value : prediction.points;

        row.append(nameCell, pointsCell);
        body.appendChild(row);
    });

    table.appendChild(body);
    wrapper.appendChild(table);
    container.appendChild(wrapper);

    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = ONE_ROUND_OFF_RULE;
    container.appendChild(note);
}

/* =========================================================== standings and "my picks" */

// Other teams' picks stay private until the league has started (see firestore.rules), so the standings only exist then.
// Before that a registered team just gets a button to look at its own picks.
function startStandings(league)
{
    if (phase === "ongoing" || phase === "ended")
    {
        standingsStatus.textContent = "Loading the standings...";

        loadStandings(leagueId, league, { summary: true }).then(function(result) {
            standingsRows = result.rows;
            drawStandings();
            setUpExport(league, result);
            showPickedPlayers(league, result);
        }).catch(function() {
            standingsStatus.textContent = "Could not load the standings. Try again later.";
        });
    }
    else
    {
        // nothing to show until the league starts
        document.getElementById("standings-box").classList.add("hidden");
    }

    onAuthStateChanged(auth, function(user) {
        currentUser = user;

        if (standingsRows !== null)
        {
            drawStandings();
        }

        if (phase !== "ongoing" && phase !== "ended")
        {
            showMyPicksButton(user);
        }
    });
}

// every picked player and goalie with the points they have so far. A league that has ended with saved standings only loaded the totals
// for the table above, so the picks are loaded separately (one extra read of the saved copy).
async function showPickedPlayers(league, result)
{
    let rows = result.rows;

    try
    {
        if (rows.length === 0)
        {
            return;
        }

        if (!rows[0].picks)
        {
            rows = (await loadStandings(leagueId, league)).rows;
        }

        const picked = pickedPlayers(rows);
        const area = document.getElementById("picked-boards");

        area.textContent = "";
        area.append(makePickBoard("Players", "Player", picked.players), makePickBoard("Goalies", "Goalie", picked.goalies));
        document.getElementById("picked-box").classList.remove("hidden");
    }
    catch (err)
    {
        console.warn("Picked players problem:", err);
    }
}

// once the league has ended and its stats are saved, anyone can download them as an Excel file
function setUpExport(league, result)
{
    if (phase !== "ended" || !result.saved || result.rows.length === 0)
    {
        return;
    }

    const area = document.getElementById("export-area");
    const button = document.getElementById("export-button");
    area.classList.remove("hidden");

    button.addEventListener("click", async function() {
        button.disabled = true;
        button.textContent = "Exporting...";

        try
        {
            await exportLeague(leagueId, league);
            button.textContent = "Export to Excel";
        }
        catch (err)
        {
            button.textContent = "Export failed, try again";
        }

        button.disabled = false;
    });
}

// a signed-in team that has registered gets "View My Picks" (and the Register button becomes "Edit Registration")
async function showMyPicksButton(user)
{
    const old = document.getElementById("my-picks-button");

    if (old)
    {
        old.remove();
    }

    if (!user)
    {
        return;
    }

    let registered = false;

    try
    {
        registered = (await getDoc(doc(db, "leagues", leagueId, "entries", user.uid))).exists();
    }
    catch (err)
    {
        return;   // the admin account and anyone without a team just don't get the button
    }

    if (!registered || user !== currentUser)
    {
        return;
    }

    const registerButton = document.getElementById("register-button");

    if (registerButton)
    {
        registerButton.textContent = "Edit Registration";
    }

    const link = document.createElement("a");
    link.id = "my-picks-button";
    link.className = "btn";
    link.href = teamPageUrl(user.uid);
    link.textContent = "View My Picks";

    signupPlaceholder.appendChild(document.createTextNode(" "));
    signupPlaceholder.appendChild(link);
    signupPlaceholder.classList.remove("hidden");
}

function teamPageUrl(uid)
{
    return "leagueTeam.html?id=" + encodeURIComponent(leagueId) + "&team=" + encodeURIComponent(uid);
}

const COLUMNS = [
    { title: "Place", tip: "Place in the standings", value: function(row) { return row.place; } },
    { title: "P",     tip: "Total points",           value: function(row) { return formatPoints(row.total); } },
    { title: "PP",    tip: "Player points",          value: function(row) { return formatPoints(row.playerPoints); } },
    { title: "GP",    tip: "Goalie points",          value: function(row) { return formatPoints(row.goaliePoints); } },
    { title: "TP",    tip: "Team (bracket prediction) points", value: function(row) { return formatPoints(row.teamPoints); } },
    { title: "PR",    tip: "Players remaining",      value: function(row) { return row.playersRemaining; } },
    { title: "GR",    tip: "Goalies remaining",      value: function(row) { return row.goaliesRemaining; } }
];

function drawStandings()
{
    standingsBox.textContent = "";

    if (standingsRows.length === 0)
    {
        standingsStatus.textContent = "No teams registered.";
        return;
    }

    standingsStatus.textContent = "";

    const wrapper = document.createElement("div");
    wrapper.className = "scroll";

    const table = document.createElement("table");
    table.className = "stats standings";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");

    const teamHead = document.createElement("th");
    teamHead.textContent = "Team";
    headRow.appendChild(teamHead);

    COLUMNS.forEach(function(column) {
        const th = document.createElement("th");
        th.className = "num";
        th.textContent = column.title;
        th.title = column.tip;
        headRow.appendChild(th);
    });

    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");

    standingsRows.forEach(function(row) {
        const tr = document.createElement("tr");
        const nameCell = document.createElement("td");

        if (row.place >= 1 && row.place <= 3)
        {
            tr.className = "place-" + row.place;
        }

        const teamRow = document.createElement("div");
        teamRow.className = "team-row";

        // logos are PNG files in the project root named TEAMID.png
        const logoBox = document.createElement("span");
        logoBox.className = "thumb-box";
        const logo = document.createElement("img");
        logo.alt = "";
        logo.loading = "lazy";
        logo.addEventListener("error", function() { logo.remove(); });
        logo.src = encodeURIComponent(row.uid) + ".png";
        logoBox.appendChild(logo);

        const nameText = document.createElement("span");
        const link = document.createElement("a");
        link.href = teamPageUrl(row.uid);
        link.textContent = row.name;
        nameText.appendChild(link);
        appendSuffix(nameText, row.suffix);

        teamRow.append(logoBox, nameText);
        nameCell.appendChild(teamRow);
        tr.appendChild(nameCell);

        COLUMNS.forEach(function(column) {
            const td = document.createElement("td");
            td.className = "num";
            td.textContent = column.value(row);
            tr.appendChild(td);
        });

        body.appendChild(tr);
    });

    table.appendChild(body);
    wrapper.appendChild(table);
    standingsBox.appendChild(wrapper);
}