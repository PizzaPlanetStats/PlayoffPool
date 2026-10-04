// Pizza Planet - admin home page
// This check only decides what the page shows. The real protection is in firestore.rules.
// Team names are user-typed, so they are only ever shown with textContent, never as HTML.

import { auth, db, isAdmin, onAuthStateChanged, signOut } from "./firebase.js";
import {
    collection,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const checking = document.getElementById("checking");
const adminArea = document.getElementById("admin-area");
const logoutButton = document.getElementById("logout");

const teamCount = document.getElementById("team-count");
const teamsStatus = document.getElementById("teams-status");
const teamsTable = document.getElementById("teams-table");
const teamsBody = document.getElementById("teams-body");
const teamsMessage = document.getElementById("teams-message");

let teams = [];
let teamsLoaded = false;

onAuthStateChanged(auth, async function(user) {
    if (user && await isAdmin(user))
    {
        checking.classList.add("hidden");
        adminArea.classList.remove("hidden");

        if (!teamsLoaded)
        {
            teamsLoaded = true;
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
                joined: data.createdAt ? data.createdAt.toDate() : null
            };
        });

        teams.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });

        renderTeams();
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

        // delete button
        const deleteCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn small";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function() {
            deleteTeam(team, deleteButton);
        });
        deleteCell.appendChild(deleteButton);

        row.append(nameCell, idCell, joinedCell, deleteCell);
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
        await deleteDoc(doc(db, "users", team.id));

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