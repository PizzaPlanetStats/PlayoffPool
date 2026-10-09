// Pizza Planet - manage a league (manageLeague.html?id=LEAGUE_ID, admin only)
// This check only decides what the page shows. The real protection is in firestore.rules.
//
// 1. Player groups, saved on the league as  playerGroups: [{ id, name, allowOther, players: [{ id, name, team, position }] }]
//    Each team picks exactly 1 player from every group when it registers.
// 2. Bracket results, saved on the league as  results: { winners: [15 team codes] }
//    Click the winner of each match. Who was knocked out in which round is worked out from that,
//    so the two can never disagree. See bracketLogic.js for how the 15 winners map onto the bracket.
//
// Names are typed in by people, so they are only ever shown with textContent, never as HTML.

import { auth, db, isAdmin, onAuthStateChanged } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { NHL_TEAMS } from "./nhlTeams.js";
import { renderBracket } from "./bracket.js";
import { CHAMPION, normalizeCodes, cleanWinners, eliminationRounds } from "./bracketLogic.js";
import { loadPlayers, searchPlayers, normalizeName } from "./nhlPlayers.js";

const MAX_GROUPS = 50;
const MAX_PLAYERS_PER_GROUP = 60;

const checking = document.getElementById("checking");
const status = document.getElementById("status");
const manageArea = document.getElementById("manage-area");
const leagueName = document.getElementById("league-name");

const nhlStatus = document.getElementById("nhl-status");
const groupsBox = document.getElementById("groups");
const addGroupButton = document.getElementById("add-group");
const groupCount = document.getElementById("group-count");
const groupsMessage = document.getElementById("groups-message");
const saveGroupsButton = document.getElementById("save-groups");

const noTeamsNote = document.getElementById("no-teams-note");
const resultsBox = document.getElementById("results-box");
const statusBox = document.getElementById("status-box");
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

let leagueYear = 0;
let codes = [];
let winners = [];
let groups = [];
let nhlPlayers = null;       // the NHL player list once it has loaded
let nhlState = "loading";    // "loading", "ready" or "failed"
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

    leagueYear = data.year;
    leagueName.textContent = String(data.name || (data.year + " League"));

    status.classList.add("hidden");
    manageArea.classList.remove("hidden");

    // ----- player groups -----
    groups = normalizeGroups(data.playerGroups);
    renderGroups();
    loadNhlPlayers();

    // ----- bracket results -----
    codes = normalizeCodes(data.playoffTeams);

    if (codes.every(function(code) { return code === ""; }))
    {
        resultsBox.classList.add("hidden");
        statusBox.classList.add("hidden");
        noTeamsNote.classList.remove("hidden");
        return;
    }

    const saved = data.results && Array.isArray(data.results.winners) ? data.results.winners : [];
    winners = cleanWinners(codes, saved);
    draw();

    // if cleaning removed results that no longer fit (for example a team was swapped), ask for a save
    if (winners.some(function(winner, i) { return winner !== (saved[i] || ""); }))
    {
        unsavedNote.classList.remove("hidden");
    }
}

/* =========================================================== player groups */

function newGroupId()
{
    let id;

    do
    {
        id = "g" + Math.random().toString(36).slice(2, 8);
    }
    while (id.length < 4 || groups.some(function(group) { return group.id === id; }));

    return id;
}

// saved groups, or an empty list. Anything missing gets a sensible value.
function normalizeGroups(saved)
{
    if (!Array.isArray(saved))
    {
        return [];
    }

    return saved.map(function(group, index) {
        return {
            id: String(group.id || "g" + index),
            name: "Group " + (index + 1),
            allowOther: group.allowOther === true,
            players: (Array.isArray(group.players) ? group.players : []).map(function(player) {
                return {
                    id: String(player.id || ""),
                    name: String(player.name || ""),
                    team: String(player.team || ""),
                    position: String(player.position || "")
                };
            })
        };
    });
}

// get the NHL player list, then redraw so every group gets its search box
async function loadNhlPlayers()
{
    nhlStatus.textContent = "Loading the NHL player list (every team's roster)...";

    try
    {
        nhlPlayers = await loadPlayers(leagueYear);
        nhlState = "ready";

        if (nhlPlayers.length === 0)
        {
            nhlState = "failed";
            nhlStatus.textContent = "The NHL has no players on file for the " + (leagueYear - 1) + "-" + String(leagueYear).slice(2)
                + " season, so players can't be searched. You can add them by name below instead.";
        }
        else
        {
            nhlStatus.textContent = nhlPlayers.length + " NHL players loaded. Type a name in a group to find a player.";
        }
    }
    catch (err)
    {
        nhlState = "failed";
        nhlStatus.textContent = "Could not reach the NHL player list (the Cloudflare Worker), so players can't be searched. "
            + "You can add them by name below, but they won't be checked against the NHL data.";
    }

    renderGroups();
}

function renderGroups()
{
    groupsBox.textContent = "";

    groups.forEach(function(group, index) {
        groupsBox.appendChild(buildGroupCard(group, index));
    });

    groupCount.textContent = groups.length + " of " + MAX_GROUPS + " groups";
    addGroupButton.disabled = groups.length >= MAX_GROUPS;
}

function groupMessage(text)
{
    groupsMessage.classList.add("error");
    groupsMessage.textContent = text;
}

function buildGroupCard(group, index)
{
    const card = document.createElement("div");
    card.className = "group-card";

    // name, "Other" choice, remove button
    const head = document.createElement("div");
    head.className = "group-head";

    const number = document.createElement("span");
    number.className = "group-number";
    number.textContent = "Group " + (index + 1);

    const otherLabel = document.createElement("label");
    otherLabel.className = "inline-check";
    const otherBox = document.createElement("input");
    otherBox.type = "checkbox";
    otherBox.checked = group.allowOther;
    otherBox.addEventListener("change", function() {
        group.allowOther = otherBox.checked;
    });
    otherLabel.append(otherBox, " Add an \"Other\" option");

    const removeGroup = document.createElement("button");
    removeGroup.type = "button";
    removeGroup.className = "btn small";
    removeGroup.textContent = "Remove group";
    removeGroup.addEventListener("click", function() {
        const sure = confirm("Remove group " + (index + 1) + " and its players?");

        if (sure)
        {
            groups.splice(index, 1);
            renderGroups();
        }
    });

    head.append(number, otherLabel, removeGroup);
    card.appendChild(head);

    // the players in this group
    const list = document.createElement("ul");
    list.className = "group-players";

    group.players.forEach(function(player, playerIndex) {
        const item = document.createElement("li");

        const label = document.createElement("span");
        label.className = "player-name";
        label.textContent = player.name + (player.id ? "" : " (not matched to the NHL)");

        const teamInput = document.createElement("input");
        teamInput.type = "text";
        teamInput.maxLength = 4;
        teamInput.className = "team-input";
        teamInput.value = player.team;
        teamInput.placeholder = "Team";
        teamInput.setAttribute("aria-label", "Team for " + player.name);
        teamInput.addEventListener("input", function() {
            teamInput.value = teamInput.value.toUpperCase();
            player.team = teamInput.value;
        });

        const removePlayer = document.createElement("button");
        removePlayer.type = "button";
        removePlayer.className = "btn small";
        removePlayer.textContent = "Remove";
        removePlayer.addEventListener("click", function() {
            group.players.splice(playerIndex, 1);
            renderGroups();
        });

        item.append(label, teamInput, removePlayer);
        list.appendChild(item);
    });

    if (group.players.length === 0)
    {
        const none = document.createElement("li");
        none.textContent = "No players yet.";
        list.appendChild(none);
    }

    card.appendChild(list);
    card.appendChild(buildPlayerAdder(group, index));

    return card;
}

// the search box (or, when the NHL list isn't available, a name box) for adding a player to a group
function buildPlayerAdder(group, groupIndex)
{
    const adder = document.createElement("div");
    adder.className = "player-adder";

    if (nhlState === "loading")
    {
        adder.textContent = "Loading the NHL player list...";
        return adder;
    }

    if (nhlState === "ready")
    {
        const search = document.createElement("input");
        search.type = "text";
        search.placeholder = "Search for a player to add";
        search.autocomplete = "off";
        search.setAttribute("aria-label", "Search for a player to add to group " + (groupIndex + 1));

        const results = document.createElement("div");
        results.className = "search-results";

        search.addEventListener("input", function() {
            results.textContent = "";

            const matches = searchPlayers(nhlPlayers, search.value, 10);

            if (matches.length === 0 && search.value.trim() !== "")
            {
                const none = document.createElement("p");
                none.className = "hint";
                none.textContent = "No NHL player found with that name.";
                results.appendChild(none);
            }

            matches.forEach(function(player) {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = player.name + (player.team ? " (" + player.team + ")" : "");
                button.addEventListener("click", function() {
                    addPlayer(group, player);
                });
                results.appendChild(button);
            });
        });

        adder.append(search, results);
        return adder;
    }

    // the NHL list isn't available: add by name only
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 40;
    nameInput.placeholder = "Player name";
    nameInput.setAttribute("aria-label", "Player name to add to group " + (groupIndex + 1));

    const teamInput = document.createElement("input");
    teamInput.type = "text";
    teamInput.maxLength = 4;
    teamInput.className = "team-input";
    teamInput.placeholder = "Team";
    teamInput.setAttribute("aria-label", "Team for the new player");

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "btn small";
    addButton.textContent = "Add";
    addButton.addEventListener("click", function() {
        const name = nameInput.value.trim().replace(/\s+/g, " ");

        if (name.length < 2)
        {
            groupMessage("Type the player's name first.");
            return;
        }

        addPlayer(group, { id: "", name: name, team: teamInput.value.trim().toUpperCase(), position: "" });
    });

    adder.append(nameInput, teamInput, addButton);
    return adder;
}

// the same player can't be in two groups, so teams can't pick them twice
function addPlayer(group, player)
{
    groupsMessage.textContent = "";

    if (group.players.length >= MAX_PLAYERS_PER_GROUP)
    {
        groupMessage("A group can have up to " + MAX_PLAYERS_PER_GROUP + " players.");
        return;
    }

    const norm = normalizeName(player.name);

    for (let i = 0; i < groups.length; i++)
    {
        const found = groups[i].players.some(function(other) {
            return (player.id !== "" && other.id === player.id) || normalizeName(other.name) === norm;
        });

        if (found)
        {
            groupMessage(player.name + " is already in group " + (i + 1) + "" + ". A player can only be in one group.");
            return;
        }
    }

    group.players.push({ id: player.id, name: player.name, team: player.team, position: player.position });
    renderGroups();
}

addGroupButton.addEventListener("click", function() {
    groupsMessage.textContent = "";

    if (groups.length >= MAX_GROUPS)
    {
        groupMessage("A league can have up to " + MAX_GROUPS + " groups.");
        return;
    }

    groups.push({ id: newGroupId(), name: "", allowOther: false, players: [] });
    renderGroups();
});

saveGroupsButton.addEventListener("click", async function() {
    groupsMessage.classList.add("error");
    groupsMessage.textContent = "";

    if (groups.length < 1)
    {
        groupMessage("Add at least 1 group.");
        return;
    }

    const toSave = [];

    for (let i = 0; i < groups.length; i++)
    {
        const group = groups[i];
        const name = "Group " + (i + 1);

        if (group.players.length === 0 && !group.allowOther)
        {
            groupMessage("Group " + (i + 1) + " needs at least 1 player, or an \"Other\" option.");
            return;
        }

        toSave.push({
            id: group.id,
            name: name,
            allowOther: group.allowOther,
            players: group.players.map(function(player) {
                return {
                    id: player.id,
                    name: player.name,
                    team: player.team.trim().toUpperCase().slice(0, 4),
                    position: player.position
                };
            })
        });
    }

    saveGroupsButton.disabled = true;

    try
    {
        await updateDoc(doc(db, "leagues", leagueId), { playerGroups: toSave });

        groups = normalizeGroups(toSave);
        renderGroups();
        groupsMessage.classList.remove("error");
        groupsMessage.textContent = "Groups saved.";
    }
    catch (err)
    {
        if (err.code === "permission-denied")
        {
            groupMessage("Firebase refused to save. Check that the new rules are published.");
        }
        else
        {
            groupMessage("Could not save the groups. Try again.");
        }
    }

    saveGroupsButton.disabled = false;
});

/* =========================================================== bracket results */

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