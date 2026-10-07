// Pizza Planet - admin home page
// This check only decides what the page shows. The real protection is in firestore.rules.
// Team names are user-typed, so they are only ever shown with textContent, never as HTML.

import { auth, db, isAdmin, onAuthStateChanged, signOut } from "./firebase.js";
import { leaguePhase, phaseInfo } from "./phases.js";
import {
    collection,
    getDocs,
    deleteDoc,
    writeBatch,
    doc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const checking = document.getElementById("checking");
const adminArea = document.getElementById("admin-area");
const logoutButton = document.getElementById("logout");

const leaguesStatus = document.getElementById("leagues-status");
const leaguesTable = document.getElementById("leagues-table");
const leaguesBody = document.getElementById("leagues-body");
const leaguesMessage = document.getElementById("leagues-message");

const teamCount = document.getElementById("team-count");
const teamsStatus = document.getElementById("teams-status");
const teamsTable = document.getElementById("teams-table");
const teamsBody = document.getElementById("teams-body");
const teamsMessage = document.getElementById("teams-message");

const syncBox = document.getElementById("sync-box");
const syncNote = document.getElementById("sync-note");
const syncButton = document.getElementById("sync-button");
const syncMessage = document.getElementById("sync-message");

let leagues = [];
let teams = [];
let missingPublic = [];
let dataLoaded = false;

onAuthStateChanged(auth, async function(user) {
    if (user && await isAdmin(user))
    {
        checking.classList.add("hidden");
        adminArea.classList.remove("hidden");

        if (!dataLoaded)
        {
            dataLoaded = true;
            loadLeagues();
            loadTeams();
        }
    }
    else
    {
        location.replace("admin.html");
    }
});

logoutButton.addEventListener("click", async function() {
    await signOut(auth);
    location.replace("admin.html");
});

// ---------- leagues ----------

async function loadLeagues()
{
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
                phase: leaguePhase(data),
                created: data.createdAt ? data.createdAt.toDate() : null
            };
        });

        // newest year first, then by name
        leagues.sort(function(a, b) {
            return (b.year - a.year) || a.name.localeCompare(b.name);
        });

        renderLeagues();
    }
    catch (err)
    {
        leaguesStatus.textContent = "Could not load leagues. Check your Firestore rules and try again.";
    }
}

function renderLeagues()
{
    leaguesBody.textContent = "";

    if (leagues.length === 0)
    {
        leaguesStatus.textContent = "No leagues yet. Click Create League to make the first one.";
        leaguesStatus.classList.remove("hidden");
        leaguesTable.classList.add("hidden");
        return;
    }

    leaguesStatus.classList.add("hidden");
    leaguesTable.classList.remove("hidden");

    leagues.forEach(function(league) {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = league.name;

        const yearCell = document.createElement("td");
        yearCell.textContent = league.year;

        const phaseCell = document.createElement("td");
        phaseCell.textContent = phaseInfo(league.phase).label;

        const createdCell = document.createElement("td");
        createdCell.textContent = league.created ? league.created.toLocaleDateString() : "";

        const manageCell = document.createElement("td");
        manageCell.className = "actions";

        const manageLink = document.createElement("a");
        manageLink.className = "btn small";
        manageLink.href = "manageLeague.html?id=" + encodeURIComponent(league.id);
        manageLink.textContent = "Manage";

        const editLink = document.createElement("a");
        editLink.className = "btn small";
        editLink.href = "editLeague.html?id=" + encodeURIComponent(league.id);
        editLink.textContent = "Edit";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn small";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function() {
            deleteLeague(league, deleteButton);
        });

        manageCell.append(manageLink, editLink, deleteButton);
        row.append(nameCell, yearCell, phaseCell, createdCell, manageCell);
        leaguesBody.appendChild(row);
    });
}

async function deleteLeague(league, button)
{
    leaguesMessage.classList.add("error");
    leaguesMessage.textContent = "";

    const sure = confirm("Delete the league \"" + league.name + "\" (" + league.year + ")?\n\nThis removes its scoring settings and cannot be undone.");

    if (!sure)
    {
        return;
    }

    button.disabled = true;

    try
    {
        await deleteDoc(doc(db, "leagues", league.id));

        leagues = leagues.filter(function(other) {
            return other.id !== league.id;
        });
        renderLeagues();

        leaguesMessage.classList.remove("error");
        leaguesMessage.textContent = "Deleted " + league.name + ".";
    }
    catch (err)
    {
        button.disabled = false;
        leaguesMessage.textContent = "Could not delete " + league.name + ". Try again.";
    }
}

// ---------- teams ----------

// get every team profile from Firestore
async function loadTeams()
{
    try
    {
        const snapshot = await getDocs(collection(db, "users"));

        teams = snapshot.docs.map(function(teamDoc) {
            const data = teamDoc.data();
            return {
                id: teamDoc.id,
                name: String(data.teamName || "(no name)"),
                hasName: Boolean(data.teamName),
                joined: data.createdAt ? data.createdAt.toDate() : null
            };
        });

        teams.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });

        renderTeams();
        checkPublicTeams();
    }
    catch (err)
    {
        teamsStatus.textContent = "Could not load teams. Check your Firestore rules and try again.";
    }
}

function renderTeams()
{
    teamsBody.textContent = "";
    teamCount.textContent = teams.length;

    if (teams.length === 0)
    {
        teamsStatus.textContent = "No teams yet. Teams show up here after they sign up.";
        teamsStatus.classList.remove("hidden");
        teamsTable.classList.add("hidden");
        return;
    }

    teamsStatus.classList.add("hidden");
    teamsTable.classList.remove("hidden");

    teams.forEach(function(team) {
        const row = document.createElement("tr");

        // team name, links to the team's profile
        const nameCell = document.createElement("td");
        const link = document.createElement("a");
        link.href = "user.html?id=" + encodeURIComponent(team.id);
        link.textContent = team.name;
        nameCell.appendChild(link);

        // team id
        const idCell = document.createElement("td");
        idCell.className = "col-id id-cell";
        idCell.textContent = team.id;

        // date joined
        const joinedCell = document.createElement("td");
        joinedCell.textContent = team.joined ? team.joined.toLocaleDateString() : "";

        // edit and delete buttons
        const manageCell = document.createElement("td");
        manageCell.className = "actions";

        const editLink = document.createElement("a");
        editLink.className = "btn small";
        editLink.href = "editTeam.html?id=" + encodeURIComponent(team.id);
        editLink.textContent = "Edit";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn small";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function() {
            deleteTeam(team, deleteButton);
        });

        manageCell.append(editLink, deleteButton);

        row.append(nameCell, idCell, joinedCell, manageCell);
        teamsBody.appendChild(row);
    });
}

async function deleteTeam(team, button)
{
    teamsMessage.classList.add("error");
    teamsMessage.textContent = "";

    const sure = confirm("Delete the team \"" + team.name + "\"?\n\nThis removes it from the league and cannot be undone.");

    if (!sure)
    {
        return;
    }

    button.disabled = true;

    try
    {
        // remove the private profile and the public copy of the name together
        const batch = writeBatch(db);
        batch.delete(doc(db, "users", team.id));
        batch.delete(doc(db, "teams", team.id));
        await batch.commit();

        teams = teams.filter(function(other) {
            return other.id !== team.id;
        });
        renderTeams();

        teamsMessage.classList.remove("error");
        teamsMessage.textContent = "Deleted " + team.name + ".";
    }
    catch (err)
    {
        button.disabled = false;
        teamsMessage.textContent = "Could not delete " + team.name + ". Try again.";
    }
}

// ---------- public team list ----------
// The home page shows the public "teams" collection. Teams that signed up before it existed
// are missing from it, so this shows a button to add them. It hides itself once none are missing.

async function checkPublicTeams()
{
    try
    {
        const snapshot = await getDocs(collection(db, "teams"));
        const published = new Set(snapshot.docs.map(function(teamDoc) {
            return teamDoc.id;
        }));

        missingPublic = teams.filter(function(team) {
            return team.hasName && !published.has(team.id);
        });
    }
    catch (err)
    {
        return;
    }

    if (missingPublic.length > 0)
    {
        syncNote.textContent = missingPublic.length + " team(s) are not on the public team list yet. "
            + "These signed up before the list existed. Add them so signed-out visitors can see them.";
        syncBox.classList.remove("hidden");
    }
    else
    {
        syncBox.classList.add("hidden");
    }
}

syncButton.addEventListener("click", async function() {
    syncMessage.textContent = "";
    syncButton.disabled = true;

    try
    {
        // up to 400 teams at a time, click again if there are more
        const batch = writeBatch(db);

        missingPublic.slice(0, 400).forEach(function(team) {
            batch.set(doc(db, "teams", team.id), { teamName: team.name });
        });

        await batch.commit();
        await checkPublicTeams();
    }
    catch (err)
    {
        syncMessage.textContent = "Could not add the teams. Check that the new rules are published.";
    }

    syncButton.disabled = false;
});