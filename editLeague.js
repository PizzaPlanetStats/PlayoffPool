// Pizza Planet - edit a league (editLeague.html?id=LEAGUE_ID, admin only)
// This check only decides what the page shows. The real protection is in firestore.rules.

import { auth, db, isAdmin, onAuthStateChanged } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc,
    deleteField
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { SKATER_STATS, GOALIE_STATS } from "./stats.js";
import { leaguePhase } from "./phases.js";
import {
    buildRows,
    collectScoring,
    fillScoring,
    readDetails,
    buildPlayoffTeams,
    collectPlayoffTeams,
    fillPlayoffTeams,
    buildPredictionPoints,
    collectPredictionPoints,
    fillPredictionPoints,
    buildPhaseChoices,
    collectPhase,
    fillPhase
} from "./leagueForm.js";

const checking = document.getElementById("checking");
const status = document.getElementById("status");
const formArea = document.getElementById("form-area");
const form = document.getElementById("league-form");
const nameInput = document.getElementById("league-name");
const yearInput = document.getElementById("year");
const message = document.getElementById("message");
const submitButton = document.getElementById("submit");

const rows = [];
const teamSelects = [];
const predictionInputs = [];
const phaseRadios = [];
const leagueId = new URLSearchParams(location.search).get("id");
let loaded = false;

buildRows(document.getElementById("skater-body"), "skaters", SKATER_STATS, rows);
buildRows(document.getElementById("goalie-body"), "goalies", GOALIE_STATS, rows);
buildPlayoffTeams(document.getElementById("playoff-teams"), teamSelects);
buildPredictionPoints(document.getElementById("prediction-points"), predictionInputs);
buildPhaseChoices(document.getElementById("league-phase"), phaseRadios);

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
    fillPhase(phaseRadios, leaguePhase(data));
    fillScoring(rows, data.scoring || {});
    fillPlayoffTeams(teamSelects, data.playoffTeams || []);
    fillPredictionPoints(predictionInputs, data.predictionPoints);

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

    const prediction = collectPredictionPoints(predictionInputs);

    if (prediction.error)
    {
        message.textContent = prediction.error;
        return;
    }

    submitButton.disabled = true;

    try
    {
        const changes = {
            name: details.name,
            year: details.year,
            playoffTeams: playoff.teams,
            scoring: scoring
        };

        if (prediction.points)
        {
            changes.predictionPoints = prediction.points;
        }

        // older leagues stored "sign ups open" as true or false, saving moves them to a phase
        const phase = collectPhase(phaseRadios);

        if (phase)
        {
            changes.phase = phase;
            changes.signupsOpen = deleteField();
        }

        await updateDoc(doc(db, "leagues", leagueId), changes);

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