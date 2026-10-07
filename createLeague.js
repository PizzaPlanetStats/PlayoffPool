// Pizza Planet - create a league (admin only)
// This check only decides what the page shows. The real protection is in firestore.rules.
//
// Saved in Firestore as leagues/{automatic id}:
//   { name: "Pizza Planet Main League",
//     year: 2026,
//     phase: "created",   (created, open, ongoing or ended, see phases.js)
//     predictionPoints: { round1: 10, round2: 20, round3: 30, round4: 40, champion: 50 },
//     playoffTeams: ["BOS", "", "TOR", ...],   (16 spots in bracket order, "" = not set yet)
//     scoring: { skaters: { goals: 3, assists: 2 }, goalies: { wins: 4 } },
//     createdAt: (server time) }

import { auth, db, isAdmin, onAuthStateChanged } from "./firebase.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { SKATER_STATS, GOALIE_STATS } from "./stats.js";
import {
    buildRows,
    collectScoring,
    readDetails,
    buildPlayoffTeams,
    collectPlayoffTeams,
    buildPredictionPoints,
    collectPredictionPoints,
    buildPhaseChoices,
    collectPhase
} from "./leagueForm.js";

const checking = document.getElementById("checking");
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

// before July the next playoffs are this year, after that they are next year
const today = new Date();
yearInput.value = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();

buildRows(document.getElementById("skater-body"), "skaters", SKATER_STATS, rows);
buildRows(document.getElementById("goalie-body"), "goalies", GOALIE_STATS, rows);
buildPlayoffTeams(document.getElementById("playoff-teams"), teamSelects);
buildPredictionPoints(document.getElementById("prediction-points"), predictionInputs);
buildPhaseChoices(document.getElementById("league-phase"), phaseRadios);

onAuthStateChanged(auth, async function(user) {
    if (user && await isAdmin(user))
    {
        checking.classList.add("hidden");
        formArea.classList.remove("hidden");
    }
    else
    {
        location.replace("admin.html");
    }
});

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
        const league = {
            name: details.name,
            year: details.year,
            phase: collectPhase(phaseRadios) || "created",
            playoffTeams: playoff.teams,
            scoring: scoring,
            createdAt: serverTimestamp()
        };

        if (prediction.points)
        {
            league.predictionPoints = prediction.points;
        }

        await addDoc(collection(db, "leagues"), league);

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
            message.textContent = "Could not create the league. Try again.";
        }
    }

    submitButton.disabled = false;
});