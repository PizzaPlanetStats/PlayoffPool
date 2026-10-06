// Pizza Planet - manage a league: enter the playoff results (manageLeague.html?id=LEAGUE_ID, admin only)
// This check only decides what the page shows. The real protection is in firestore.rules.
//
// Results are saved on the league as   results: { winners: [15 team codes] }
// Click the winner of each match. Who was knocked out in which round is worked out from that,
// so the two can never disagree. See bracketLogic.js for how the 15 winners map onto the bracket.

import { auth, db, isAdmin, onAuthStateChanged } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { NHL_TEAMS } from "./nhlTeams.js";
import { renderBracket } from "./bracket.js";
import { CHAMPION, normalizeCodes, cleanWinners, eliminationRounds } from "./bracketLogic.js";

const checking = document.getElementById("checking");
const status = document.getElementById("status");
const manageArea = document.getElementById("manage-area");
const leagueName = document.getElementById("league-name");
const bracketBox = document.getElementById("bracket");
const unsavedNote = document.getElementById("unsaved");
const message = document.getElementById("message");
const saveButton = document.getElementById("save");
const statusBody = document.getElementById("status-body");

const leagueId = new URLSearchParams(location.search).get("id");

const names = {};
NHL_TEAMS.forEach(function(team) {
    names[team.code] = team.name;
});

let codes = [];
let winners = [];
let loaded = false;

onAuthStateChanged(auth, async function(user) {
    if (!(user && await isAdmin(user)))
    {
        location.replace("admin.html");
        return;
    }

    checking.classList.add("hidden");

    if (!loaded)
    {
        loaded = true;
        loadLeague();
    }
});

function showStatus(text)
{
    status.textContent = text;
    status.classList.remove("hidden");
}

async function loadLeague()
{
    if (!leagueId || !/^[A-Za-z0-9]{1,40}$/.test(leagueId))
    {
        showStatus("League not found.");
        return;
    }

    showStatus("Loading league...");

    let data;

    try
    {
        const snap = await getDoc(doc(db, "leagues", leagueId));

        if (!snap.exists())
        {
            showStatus("League not found.");
            return;
        }

        data = snap.data();
    }
    catch (err)
    {
        showStatus("Could not load the league. Try again.");
        return;
    }

    codes = normalizeCodes(data.playoffTeams);

    if (codes.every(function(code) { return code === ""; }))
    {
        showStatus("This league has no playoff teams yet. Use Edit on the admin page to set them first.");
        return;
    }

    const saved = data.results && Array.isArray(data.results.winners) ? data.results.winners : [];
    winners = cleanWinners(codes, saved);

    leagueName.textContent = String(data.name || (data.year + " League"));

    status.classList.add("hidden");
    manageArea.classList.remove("hidden");
    draw();

    // if cleaning removed results that no longer fit (for example a team was swapped), ask for a save
    if (winners.some(function(winner, i) { return winner !== (saved[i] || ""); }))
    {
        unsavedNote.classList.remove("hidden");
    }
}

// click a team to make it the winner of its match, click the winner again to undo
function pickWinner(index, code)
{
    winners[index] = winners[index] === code ? "" : code;

    // picking a different winner removes any later results that depended on the old one
    winners = cleanWinners(codes, winners);

    message.textContent = "";
    unsavedNote.classList.remove("hidden");
    draw();
}

function draw()
{
    renderBracket(bracketBox, codes, { winners: winners, onPick: pickWinner });
    renderTeamStatus();
}

// a row for each team: still playing, knocked out in a round, or champion
function renderTeamStatus()
{
    const rounds = eliminationRounds(codes, winners);

    statusBody.textContent = "";

    codes.forEach(function(code, position) {
        if (code === "")
        {
            return;
        }

        const row = document.createElement("tr");

        const numberCell = document.createElement("td");
        numberCell.textContent = position + 1;

        const nameCell = document.createElement("td");
        nameCell.textContent = names[code] || code;

        const statusCell = document.createElement("td");

        if (rounds[code] === CHAMPION)
        {
            statusCell.textContent = "Champion";
        }
        else if (rounds[code])
        {
            statusCell.textContent = "Knocked out in round " + rounds[code];
        }
        else
        {
            statusCell.textContent = "Still playing";
        }

        row.append(numberCell, nameCell, statusCell);
        statusBody.appendChild(row);
    });
}

saveButton.addEventListener("click", async function() {
    message.classList.add("error");
    message.textContent = "";
    saveButton.disabled = true;

    try
    {
        await updateDoc(doc(db, "leagues", leagueId), { results: { winners: winners } });

        unsavedNote.classList.add("hidden");
        message.classList.remove("error");
        message.textContent = "Results saved.";
    }
    catch (err)
    {
        if (err.code === "permission-denied")
        {
            message.textContent = "Firebase refused to save. Check that the new rules are published.";
        }
        else
        {
            message.textContent = "Could not save the results. Try again.";
        }
    }

    saveButton.disabled = false;
});