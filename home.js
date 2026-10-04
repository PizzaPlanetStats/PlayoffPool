// Pizza Planet - list of teams on the home page
// Only signed-in teams can read the team list (see firestore.rules).
// Team names are user-typed, so they are only ever shown with textContent, never as HTML.

import { db } from "./firebase.js";
import { auth, onAuthStateChanged } from "./team.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const signupPrompt = document.getElementById("signup-prompt");
const teamsStatus = document.getElementById("teams-status");
const teamsTable = document.getElementById("teams-table");
const teamsBody = document.getElementById("teams-body");

let loadedFor = null;

function showSignInMessage()
{
    teamsStatus.textContent = "Only signed in teams can see the league. ";

    const link = document.createElement("a");
    link.href = "signin.html";
    link.textContent = "Sign in";
    teamsStatus.appendChild(link);

    teamsStatus.classList.remove("hidden");
    teamsTable.classList.add("hidden");
    loadedFor = null;
}

async function loadTeams(user)
{
    teamsStatus.textContent = "Loading teams...";
    teamsStatus.classList.remove("hidden");

    let teams;

    try
    {
        const snapshot = await getDocs(collection(db, "users"));

        teams = snapshot.docs.map(function(teamDoc) {
            const data = teamDoc.data();
            return {
                id: teamDoc.id,
                name: String(data.teamName || "(no name)")
            };
        });
    }
    catch (err)
    {
        teamsStatus.textContent = "The team list is only available to teams in the league.";
        teamsTable.classList.add("hidden");
        return;
    }

    teams.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    renderTeams(teams, user);
}

function renderTeams(teams, user)
{
    teamsBody.textContent = "";

    if (teams.length === 0)
    {
        teamsStatus.textContent = "No teams yet.";
        teamsTable.classList.add("hidden");
        return;
    }

    teamsStatus.classList.add("hidden");
    teamsTable.classList.remove("hidden");

    teams.forEach(function(team) {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");

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
        nameCell.appendChild(logoBox);

        const link = document.createElement("a");
        link.href = "user.html?id=" + encodeURIComponent(team.id);
        link.textContent = team.name;
        nameCell.appendChild(link);

        // mark the signed-in team's own row
        if (user && user.uid === team.id)
        {
            nameCell.appendChild(document.createTextNode(" (you)"));
        }

        row.append(nameCell);
        teamsBody.appendChild(row);
    });
}

onAuthStateChanged(auth, function(user) {
    // no need to offer sign up to someone who is already signed in
    signupPrompt.classList.toggle("hidden", Boolean(user));

    if (!user)
    {
        showSignInMessage();
        return;
    }

    // the auth state can fire more than once, only load once per person
    if (loadedFor !== user.uid)
    {
        loadedFor = user.uid;
        loadTeams(user);
    }
});