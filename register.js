// Pizza Planet - register for a league (register.html?id=LEAGUE_ID)
// Step 1 is the bracket prediction, step 2 is one player from every group.
//
// A registration is saved at  leagues/{leagueId}/entries/{teamId}  (one per team, so saving again edits it):
//   { bracket: { winners: [15 team codes] },
//     players: { GROUP_ID: { type: "option", id, name, team }  or  { type: "other", name } },
//     createdAt: (server time) }
//
// Team names and player names are typed in by people, so they are only ever shown with textContent.

import { db } from "./firebase.js";
import { auth, onAuthStateChanged, getProfile } from "./team.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { renderBracket } from "./bracket.js";
import { MATCH_COUNT, normalizeCodes, cleanWinners } from "./bracketLogic.js";
import { leaguePhase } from "./phases.js";
import { loadPlayers, findPlayerByName, normalizeName } from "./nhlPlayers.js";

const status = document.getElementById("status");
const registerArea = document.getElementById("register-area");
const leagueName = document.getElementById("league-name");
const registeringAs = document.getElementById("registering-as");

const stepBracket = document.getElementById("step-bracket");
const bracketBox = document.getElementById("bracket");
const bracketCount = document.getElementById("bracket-count");
const bracketMessage = document.getElementById("bracket-message");
const toPlayersButton = document.getElementById("to-players");

const stepPlayers = document.getElementById("step-players");
const groupsBox = document.getElementById("groups");
const submitMessage = document.getElementById("submit-message");
const backButton = document.getElementById("back");
const submitButton = document.getElementById("submit");

const leagueId = new URLSearchParams(location.search).get("id");

let user = null;
let leagueYear = 0;
let codes = [];
let winners = new Array(MATCH_COUNT).fill("");
let groups = [];
let selections = [];       // one per group: { group, radios, otherRadio, otherInput, card }
let hasEntry = false;
let started = false;

onAuthStateChanged(auth, function(signedIn) {
    // the page only needs to start once
    if (started)
    {
        return;
    }

    started = true;
    user = signedIn;
    start();
});

function showStatus(text)
{
    status.textContent = text;
    status.classList.remove("hidden");
}

function showSignInPrompt()
{
    status.textContent = "Sign in with your team to register. ";

    const signIn = document.createElement("a");
    signIn.href = "signin.html";
    signIn.textContent = "Sign in";

    const signUp = document.createElement("a");
    signUp.href = "signup.html";
    signUp.textContent = "create a team";

    status.append(signIn, " or ", signUp, ", then come back and click Register on the league page.");
    status.classList.remove("hidden");
}

async function start()
{
    if (!leagueId || !/^[A-Za-z0-9]{1,40}$/.test(leagueId))
    {
        showStatus("League not found.");
        return;
    }

    if (!user)
    {
        showSignInPrompt();
        return;
    }

    let league;
    let profile;
    let entry = null;

    try
    {
        const snap = await getDoc(doc(db, "leagues", leagueId));

        if (!snap.exists())
        {
            showStatus("League not found.");
            return;
        }

        league = snap.data();
        profile = await getProfile(user.uid);

        try
        {
            const entrySnap = await getDoc(doc(db, "leagues", leagueId, "entries", user.uid));
            entry = entrySnap.exists() ? entrySnap.data() : null;
        }
        catch (err)
        {
            entry = null;
        }
    }
    catch (err)
    {
        showStatus("Could not load this league. Try again later.");
        return;
    }

    if (leaguePhase(league) !== "open")
    {
        showStatus("Registration is not open for this league.");
        return;
    }

    if (!profile)
    {
        showStatus("You need a team account to register. The admin account can't register.");
        return;
    }

    codes = normalizeCodes(league.playoffTeams);

    if (codes.some(function(code) { return code === ""; }))
    {
        showStatus("The playoff bracket isn't complete yet, so registration can't start. Check back soon.");
        return;
    }

    groups = Array.isArray(league.playerGroups) ? league.playerGroups.map(cleanGroup) : [];

    if (groups.length === 0)
    {
        showStatus("The player groups haven't been set up yet, so registration can't start. Check back soon.");
        return;
    }

    leagueYear = league.year;
    hasEntry = entry !== null;

    leagueName.textContent = String(league.name || (league.year + " League"));
    registeringAs.textContent = (hasEntry ? "Editing the registration for " : "Registering ") + profile.teamName;

    if (hasEntry && entry.bracket)
    {
        winners = cleanWinners(codes, entry.bracket.winners);
    }

    buildGroups(entry);
    drawBracket();

    submitButton.textContent = hasEntry ? "Save Changes" : "Submit Registration";

    status.classList.add("hidden");
    registerArea.classList.remove("hidden");
}

function cleanGroup(group, index)
{
    return {
        id: String(group.id || "g" + index),
        name: "Group " + (index + 1),
        allowOther: group.allowOther === true,
        players: (Array.isArray(group.players) ? group.players : []).map(function(player) {
            return {
                id: String(player.id || ""),
                name: String(player.name || ""),
                team: String(player.team || "")
            };
        })
    };
}

/* =========================================================== step 1: bracket */

function pickWinner(index, code)
{
    winners[index] = winners[index] === code ? "" : code;
    winners = cleanWinners(codes, winners);

    bracketMessage.textContent = "";
    drawBracket();
}

function pickedCount()
{
    return winners.filter(function(winner) {
        return winner !== "";
    }).length;
}

function drawBracket()
{
    renderBracket(bracketBox, codes, { winners: winners, onPick: pickWinner });
    bracketCount.textContent = pickedCount() + " of " + MATCH_COUNT + " matches picked.";
}

toPlayersButton.addEventListener("click", function() {
    bracketMessage.classList.add("error");
    bracketMessage.textContent = "";

    if (pickedCount() < MATCH_COUNT)
    {
        bracketMessage.textContent = "Pick a winner for every match first (" + pickedCount() + " of " + MATCH_COUNT + " done).";
        return;
    }

    stepBracket.classList.add("hidden");
    stepPlayers.classList.remove("hidden");
    window.scrollTo(0, 0);
});

backButton.addEventListener("click", function() {
    stepPlayers.classList.add("hidden");
    stepBracket.classList.remove("hidden");
    window.scrollTo(0, 0);
});

/* =========================================================== step 2: players */

// one box per group with a radio button for each player, and an Other box if the group has one
function buildGroups(entry)
{
    groupsBox.textContent = "";
    selections = [];

    groups.forEach(function(group, index) {
        const card = document.createElement("div");
        card.className = "group-card";

        const title = document.createElement("div");
        title.className = "group-title";
        title.textContent = group.name;
        card.appendChild(title);

        const radioName = "group-" + group.id;
        const radios = [];

        group.players.forEach(function(player, playerIndex) {
            const label = document.createElement("label");
            label.className = "pick";

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = radioName;
            radio.value = "p" + playerIndex;

            label.append(radio, player.name + (player.team ? " (" + player.team + ")" : ""));
            card.appendChild(label);
            radios.push(radio);
        });

        let otherRadio = null;
        let otherInput = null;

        if (group.allowOther)
        {
            const label = document.createElement("label");
            label.className = "pick";

            otherRadio = document.createElement("input");
            otherRadio.type = "radio";
            otherRadio.name = radioName;
            otherRadio.value = "other";

            otherInput = document.createElement("input");
            otherInput.type = "text";
            otherInput.maxLength = 40;
            otherInput.placeholder = "Type any player's name";
            otherInput.autocomplete = "off";
            otherInput.setAttribute("aria-label", "Other player for " + group.name);

            // typing in the box picks Other
            otherInput.addEventListener("input", function() {
                otherRadio.checked = true;
            });

            label.append(otherRadio, "Other: ", otherInput);
            card.appendChild(label);
        }

        selections.push({ group: group, radios: radios, otherRadio: otherRadio, otherInput: otherInput, card: card });
        groupsBox.appendChild(card);

        // fill in the saved pick when editing a registration
        const saved = entry && entry.players ? entry.players[group.id] : null;

        if (saved && saved.type === "option")
        {
            const savedIndex = group.players.findIndex(function(player) {
                return (saved.id && player.id === saved.id) || normalizeName(player.name) === normalizeName(saved.name || "");
            });

            if (savedIndex >= 0)
            {
                radios[savedIndex].checked = true;
            }
        }
        else if (saved && saved.type === "other" && otherRadio)
        {
            otherRadio.checked = true;
            otherInput.value = String(saved.name || "");
        }
    });
}

function fail(text, card)
{
    return { error: text, card: card };
}

// works out the pick for every group, or returns an error to show
function collectPicks()
{
    // every player that is a choice in some group, and which groups they are in
    const optionGroups = new Map();

    groups.forEach(function(group) {
        group.players.forEach(function(player) {
            const norm = normalizeName(player.name);

            if (!optionGroups.has(norm))
            {
                optionGroups.set(norm, new Set());
            }

            optionGroups.get(norm).add(group.id);
        });
    });

    const picks = {};
    const others = [];

    for (const selection of selections)
    {
        const group = selection.group;
        const chosen = selection.radios.find(function(radio) { return radio.checked; });
        const otherChosen = selection.otherRadio !== null && selection.otherRadio.checked;

        if (!chosen && !otherChosen)
        {
            return fail("Pick a player in \"" + group.name + "\".", selection.card);
        }

        if (chosen)
        {
            const player = group.players[Number(chosen.value.slice(1))];
            picks[group.id] = { type: "option", id: player.id, name: player.name, team: player.team };
            continue;
        }

        // an Other player
        const name = selection.otherInput.value.trim().replace(/\s+/g, " ");
        const norm = normalizeName(name);

        if (norm === "")
        {
            return fail("Type a player's name in the Other box for \"" + group.name + "\", or pick one of the players.", selection.card);
        }

        const homes = optionGroups.get(norm);

        if (homes)
        {
            const elsewhere = Array.from(homes).find(function(id) { return id !== group.id; });

            if (elsewhere)
            {
                const otherGroup = groups.find(function(g) { return g.id === elsewhere; });
                return fail("\"" + name + "\" is already a choice in the group \"" + otherGroup.name + "\", so you can't enter them in \""
                    + group.name + "\". Pick them in that group, or choose someone else here.", selection.card);
            }

            // they are a choice in this very group, so just use that choice
            const player = group.players.find(function(p) { return normalizeName(p.name) === norm; });
            picks[group.id] = { type: "option", id: player.id, name: player.name, team: player.team };
            continue;
        }

        others.push({ name: name, norm: norm, card: selection.card });
        picks[group.id] = { type: "other", name: name };
    }

    // the same custom player can't be used in two groups either
    const seen = new Set();

    for (const other of others)
    {
        if (seen.has(other.norm))
        {
            return fail("You typed \"" + other.name + "\" in more than one group. Each player can only be picked once.", other.card);
        }

        seen.add(other.norm);
    }

    return { picks: picks, customNames: others.map(function(other) { return other.name; }) };
}

// custom players that don't show up in the NHL data. This is only a warning, never a block,
// and if the NHL data can't be loaded there is simply no warning.
async function findUnknownPlayers(customNames)
{
    try
    {
        const players = await loadPlayers(leagueYear);

        if (players.length === 0)
        {
            return [];
        }

        return customNames.filter(function(name) {
            return !findPlayerByName(players, name);
        });
    }
    catch (err)
    {
        return [];
    }
}

submitButton.addEventListener("click", async function() {
    submitMessage.classList.add("error");
    submitMessage.textContent = "";

    const result = collectPicks();

    if (result.error)
    {
        submitMessage.textContent = result.error;
        result.card.scrollIntoView({ block: "center" });
        return;
    }

    submitButton.disabled = true;
    backButton.disabled = true;

    try
    {
        if (result.customNames.length > 0)
        {
            submitMessage.classList.remove("error");
            submitMessage.textContent = "Checking players...";

            const unknown = await findUnknownPlayers(result.customNames);

            submitMessage.textContent = "";
            submitMessage.classList.add("error");

            if (unknown.length > 0)
            {
                const list = unknown.map(function(name) { return "\"" + name + "\""; }).join(", ");
                const go = confirm(list + (unknown.length === 1 ? " doesn't" : " don't")
                    + " appear on an NHL team's roster, so they may not be an NHL player.\n\n"
                    + "You can still submit them. Submit anyway?");

                if (!go)
                {
                    submitButton.disabled = false;
                    backButton.disabled = false;
                    return;
                }
            }
        }

        const ref = doc(db, "leagues", leagueId, "entries", user.uid);
        const entry = { bracket: { winners: winners }, players: result.picks };

        if (hasEntry)
        {
            await updateDoc(ref, entry);
        }
        else
        {
            entry.createdAt = serverTimestamp();
            await setDoc(ref, entry);
        }

        showDone();
        return;
    }
    catch (err)
    {
        submitMessage.classList.add("error");

        if (err.code === "permission-denied")
        {
            submitMessage.textContent = "Firebase refused to save. Registration may have just closed.";
        }
        else
        {
            submitMessage.textContent = "Could not save your registration. Try again.";
        }
    }

    submitButton.disabled = false;
    backButton.disabled = false;
});

function showDone()
{
    registerArea.classList.add("hidden");

    status.textContent = "You're registered! Your picks are saved. You can change them any time while registration is open. ";

    const link = document.createElement("a");
    link.href = "league.html?id=" + encodeURIComponent(leagueId);
    link.textContent = "Back to the league";

    status.appendChild(link);
    status.classList.remove("hidden");
    window.scrollTo(0, 0);
}