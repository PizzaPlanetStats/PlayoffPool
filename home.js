// Pizza Planet - leagues and teams lists on the home page
// Both lists are public. Team names come from the public "teams" collection (see firestore.rules).
// Names are typed in by people, so they are only ever shown with textContent, never as HTML.

import { db } from "./firebase.js";
import { auth, onAuthStateChanged } from "./team.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const signupPrompt = document.getElementById("signup-prompt");

const leaguesStatus = document.getElementById("leagues-status");
const leaguesTable = document.getElementById("leagues-table");
const leaguesBody = document.getElementById("leagues-body");

const teamsStatus = document.getElementById("teams-status");
const teamsTable = document.getElementById("teams-table");
const teamsBody = document.getElementById("teams-body");

let teams = null;
let currentUser = null;

onAuthStateChanged(auth, function(user) {
    currentUser = user;

    // no need to offer sign up to someone who is already signed in
    signupPrompt.classList.toggle("hidden", Boolean(user));

    // redraw so the signed-in team gets its "(you)" mark
    if (teams !== null)
    {
        renderTeams();
    }
});

loadLeagues();
loadTeams();

// ---------- leagues ----------

async function loadLeagues()
{
    let leagues;

    try
    {
        const snapshot = await getDocs(collection(db, "leagues"));

        leagues = snapshot.docs.map(function(leagueDoc) {
            const data = leagueDoc.data();
            return {
                id: leagueDoc.id,
                // leagues made before names existed show their year as the name
                name: String(data.name || (data.year + " League")),
                year: data.year,
                open: data.signupsOpen === true
            };
        });
    }
    catch (err)
    {
        leaguesStatus.textContent = "Could not load the leagues. Try again later.";
        return;
    }

    // newest year first, then by name
    leagues.sort(function(a, b) {
        return (b.year - a.year) || a.name.localeCompare(b.name);
    });

    renderLeagues(leagues);
}

function renderLeagues(leagues)
{
    leaguesBody.textContent = "";

    if (leagues.length === 0)
    {
        leaguesStatus.textContent = "No leagues yet.";
        leaguesTable.classList.add("hidden");
        return;
    }

    leaguesStatus.classList.add("hidden");
    leaguesTable.classList.remove("hidden");

    leagues.forEach(function(league) {
        const row = document.createElement("tr");

        // league name, links to the league's page
        const nameCell = document.createElement("td");
        const link = document.createElement("a");
        link.href = "league.html?id=" + encodeURIComponent(league.id);
        link.textContent = league.name;
        nameCell.appendChild(link);

        const yearCell = document.createElement("td");
        yearCell.textContent = league.year;

        const registrationCell = document.createElement("td");
        registrationCell.textContent = league.open ? "Open" : "Closed";

        row.append(nameCell, yearCell, registrationCell);
        leaguesBody.appendChild(row);
    });
}

// ---------- teams ----------

async function loadTeams()
{
    try
    {
        const snapshot = await getDocs(collection(db, "teams"));

        teams = snapshot.docs.map(function(teamDoc) {
            return {
                id: teamDoc.id,
                name: String(teamDoc.data().teamName || "(no name)")
            };
        });
    }
    catch (err)
    {
        teamsStatus.textContent = "Could not load the teams. Try again later.";
        return;
    }

    teams.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    renderTeams();
}

function renderTeams()
{
    teamsBody.textContent = "";

    if (teams.length === 0)
    {
        teamsStatus.textContent = "No teams yet.";
        teamsStatus.classList.remove("hidden");
        teamsTable.classList.add("hidden");
        return;
    }

    teamsStatus.classList.add("hidden");
    teamsTable.classList.remove("hidden");

    teams.forEach(function(team) {
        const row = document.createElement("tr");
        const nameCell = document.createElement("td");

        // one flex row per team so the logo and name are centered on each other
        const teamRow = document.createElement("div");
        teamRow.className = "team-row";
        nameCell.appendChild(teamRow);

        // logo box keeps team names lined up, even for teams with no logo
        const logoBox = document.createElement("span");
        logoBox.className = "thumb-box";

        // logos are PNG files in the project root named TEAMID.png
        const logo = document.createElement("img");
        logo.alt = "";
        logo.loading = "lazy";
        logo.addEventListener("error", function() {
            logo.remove();
        });
        logo.src = encodeURIComponent(team.id) + ".png";
        logoBox.appendChild(logo);
        teamRow.appendChild(logoBox);

        const nameText = document.createElement("span");
        const link = document.createElement("a");
        link.href = "user.html?id=" + encodeURIComponent(team.id);
        link.textContent = team.name;
        nameText.appendChild(link);

        // mark the signed-in team's own row
        if (currentUser && currentUser.uid === team.id)
        {
            nameText.appendChild(document.createTextNode(" (you)"));
        }

        teamRow.appendChild(nameText);

        row.append(nameCell);
        teamsBody.appendChild(row);
    });
}