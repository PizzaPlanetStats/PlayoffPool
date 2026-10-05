// Pizza Planet - edit a league (editLeague.html?id=LEAGUE_ID, admin only)
// This check only decides what the page shows. The real protection is in firestore.rules.

import { auth, db, isAdmin, onAuthStateChanged } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { SKATER_STATS, GOALIE_STATS } from "./stats.js";
import {
    buildRows,
    collectScoring,
    fillScoring,
    readDetails,
    buildPlayoffTeams,
    collectPlayoffTeams,
    fillPlayoffTeams
} from "./leagueForm.js";

const checking = document.getElementById("checking");
const status = document.getElementById("status");
const formArea = document.getElementById("form-area");
const form = document.getElementById("league-form");
const nameInput = document.getElementById("league-name");
const yearInput = document.getElementById("year");
const signupsInput = document.getElementById("signups-open");
const message = document.getElementById("message");
const submitButton = document.getElementById("submit");

const rows = [];
const teamSelects = [];
const leagueId = new URLSearchParams(location.search).get("id");
let loaded = false;

buildRows(document.getElementById("skater-body"), "skaters", SKATER_STATS, rows);
buildRows(document.getElementById("goalie-body"), "goalies", GOALIE_STATS, rows);
buildPlayoffTeams(document.getElementById("playoff-teams"), teamSelects);

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
        showStatus("Could not load the league. Check your Firestore rules and try again.");
        return;
    }

    // leagues made before names existed get a suggested name
    nameInput.value = data.name || (data.year + " League");
    yearInput.value = data.year;
    signupsInput.checked = data.signupsOpen === true;
    fillScoring(rows, data.scoring || {});
    fillPlayoffTeams(teamSelects, data.playoffTeams || []);

    status.classList.add("hidden");
    formArea.classList.remove("hidden");
}

form.addEventListener("submit", async function(event) {
    event.preventDefault();
    message.textContent = "";

    const details = readDetails(nameInput.value, yearInput.value);

    if (details.error)
    {
        message.textContent = details.error;
        return;
    }

    const scoring = collectScoring(rows);

    if (scoring.error)
    {
        message.textContent = scoring.error;
        return;
    }

    const playoff = collectPlayoffTeams(teamSelects);

    if (playoff.error)
    {
        message.textContent = playoff.error;
        return;
    }

    submitButton.disabled = true;

    try
    {
        await updateDoc(doc(db, "leagues", leagueId), {
            name: details.name,
            year: details.year,
            signupsOpen: signupsInput.checked,
            playoffTeams: playoff.teams,
            scoring: scoring
        });

        location.replace("adminHome.html");
        return;
    }
    catch (err)
    {
        if (err.code === "permission-denied")
        {
            message.textContent = "Firebase refused to save. Check that the new rules are published.";
        }
        else
        {
            message.textContent = "Could not save the changes. Try again.";
        }
    }

    submitButton.disabled = false;
});