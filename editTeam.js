// Pizza Planet - edit a team's achievements (editTeam.html?id=TEAM_ID, admin only)
// This check only decides what the page shows. The real protection is in firestore.rules.
// Team names are typed in by people, so they are only ever shown with textContent, never as HTML.
//
// Achievements are saved on the team's public record: teams/{id} = { teamName, achievements: ["winner", ...] }

import { auth, db, isAdmin, onAuthStateChanged } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ACHIEVEMENTS } from "./achievements.js";

const checking = document.getElementById("checking");
const status = document.getElementById("status");
const formArea = document.getElementById("form-area");
const teamHeading = document.getElementById("team-name");
const viewLink = document.getElementById("view-link");
const tableBody = document.getElementById("achievements-body");
const form = document.getElementById("team-form");
const message = document.getElementById("message");
const submitButton = document.getElementById("submit");

const teamId = new URLSearchParams(location.search).get("id");
const rows = [];
let loaded = false;

buildRows();

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
        loadTeam();
    }
});

function buildRows()
{
    ACHIEVEMENTS.forEach(function(achievement) {
        const id = "ach-" + achievement.id;
        const row = document.createElement("tr");

        const checkCell = document.createElement("td");
        checkCell.className = "check";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = id;
        checkbox.setAttribute("aria-label", "Unlocked: " + achievement.name);
        checkCell.appendChild(checkbox);

        const nameCell = document.createElement("td");
        const label = document.createElement("label");
        label.htmlFor = id;
        label.className = "ach-label";
        label.textContent = achievement.name;
        const description = document.createElement("div");
        description.className = "ach-desc";
        description.textContent = achievement.description;
        nameCell.append(label, description);

        row.append(checkCell, nameCell);
        tableBody.appendChild(row);
        rows.push({ achievement: achievement, checkbox: checkbox });
    });
}

function showStatus(text)
{
    status.textContent = text;
    status.classList.remove("hidden");
}

async function loadTeam()
{
    if (!teamId || !/^[A-Za-z0-9]{1,128}$/.test(teamId))
    {
        showStatus("Team not found.");
        return;
    }

    showStatus("Loading team...");

    let data;

    try
    {
        const snap = await getDoc(doc(db, "teams", teamId));

        if (!snap.exists())
        {
            showStatus("Team not found on the public team list. If this is an older team, go to Admin Home and click Add to public list first.");
            return;
        }

        data = snap.data();
    }
    catch (err)
    {
        showStatus("Could not load the team. Try again.");
        return;
    }

    const unlocked = Array.isArray(data.achievements) ? data.achievements : [];

    teamHeading.textContent = String(data.teamName || "(no name)");
    viewLink.href = "user.html?id=" + encodeURIComponent(teamId);

    rows.forEach(function(row) {
        row.checkbox.checked = unlocked.includes(row.achievement.id);
    });

    status.classList.add("hidden");
    formArea.classList.remove("hidden");
}

form.addEventListener("submit", async function(event) {
    event.preventDefault();
    message.textContent = "";
    submitButton.disabled = true;

    // saved in the same order as the list in achievements.js
    const unlocked = rows.filter(function(row) {
        return row.checkbox.checked;
    }).map(function(row) {
        return row.achievement.id;
    });

    try
    {
        await updateDoc(doc(db, "teams", teamId), { achievements: unlocked });
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