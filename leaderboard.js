// Pizza Planet - leaderboards (leaderboard.html)
// Built from the saved final standings (Save Stats) of every league that has ended.
// Team names are typed in by users, so everything is shown with textContent, never as HTML.

import { db } from "./firebase.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { leaguePhase } from "./phases.js";
import { formatPoints } from "./standings.js";

const status = document.getElementById("status");
const boardsArea = document.getElementById("boards");

const TOP = 20;

const KINDS = [
    { key: "total", label: "Points" },
    { key: "playerPoints", label: "Player Points" },
    { key: "goaliePoints", label: "Goalie Points" },
    { key: "teamPoints", label: "Team Points" }
];

load();

async function load()
{
    let entries = [];   // one per team per ended league
    let names = {};

    try
    {
        const leagues = await getDocs(collection(db, "leagues"));

        const ended = leagues.docs.filter(function(leagueDoc) {
            return leaguePhase(leagueDoc.data()) === "ended";
        });

        const saved = await Promise.all(ended.map(async function(leagueDoc) {
            const snap = await getDoc(doc(db, "leagues", leagueDoc.id, "final", "standings"));
            return { league: leagueDoc, standings: snap.exists() ? (snap.data().standings || []) : [] };
        }));

        try
        {
            const teams = await getDocs(collection(db, "teams"));
            teams.forEach(function(teamDoc) { names[teamDoc.id] = String(teamDoc.data().teamName || ""); });
        }
        catch (err)
        {
            // the saved names are used instead
        }

        saved.forEach(function(item) {
            const data = item.league.data();
            const leagueName = String(data.name || (data.year + " League"));

            item.standings.forEach(function(row) {
                entries.push({
                    uid: String(row.uid), name: names[row.uid] || String(row.name || "(unknown team)"),
                    leagueId: item.league.id, leagueName: leagueName, place: Number(row.place) || 0,
                    total: Number(row.total) || 0, playerPoints: Number(row.playerPoints) || 0,
                    goaliePoints: Number(row.goaliePoints) || 0, teamPoints: Number(row.teamPoints) || 0
                });
            });
        });
    }
    catch (err)
    {
        status.textContent = "Could not load the leaderboards. Try again later.";
        return;
    }

    if (entries.length === 0)
    {
        status.textContent = "No leagues have finished yet.";
        return;
    }

    status.classList.add("hidden");
    boardsArea.classList.remove("hidden");
    draw(entries);
}

// one row per team across all leagues
function perTeam(entries)
{
    const map = new Map();

    entries.forEach(function(entry) {
        let team = map.get(entry.uid);

        if (!team)
        {
            team = { uid: entry.uid, name: entry.name, leagues: 0, wins: 0, total: 0, playerPoints: 0, goaliePoints: 0, teamPoints: 0 };
            map.set(entry.uid, team);
        }

        team.leagues++;
        team.wins += entry.place === 1 ? 1 : 0;
        KINDS.forEach(function(kind) { team[kind.key] += entry[kind.key]; });
    });

    return Array.from(map.values());
}

function draw(entries)
{
    const teams = perTeam(entries);

    addGroup("League Wins", [
        makeBoard("League Wins", teams.map(function(t) { return { uid: t.uid, name: t.name, value: t.wins }; }), null, whole)
    ]);

    addGroup("Single Season", KINDS.map(function(kind) {
        return makeBoard(kind.label, entries.map(function(e) {
            return { uid: e.uid, name: e.name, league: e.leagueName, leagueId: e.leagueId, value: e[kind.key] };
        }), "League", formatPoints);
    }));

    addGroup("All Time", KINDS.map(function(kind) {
        return makeBoard(kind.label, teams.map(function(t) {
            return { uid: t.uid, name: t.name, extra: String(t.leagues), value: t[kind.key] };
        }), "Leagues", formatPoints);
    }));

    addGroup("Average All Leagues", KINDS.map(function(kind) {
        return makeBoard(kind.label, teams.map(function(t) {
            return { uid: t.uid, name: t.name, extra: String(t.leagues), value: t[kind.key] / t.leagues };
        }), "Leagues", formatPoints);
    }));
}

function whole(value)
{
    return String(value);
}

function addGroup(title, boards)
{
    const box = document.createElement("div");
    box.className = "box";

    const heading = document.createElement("h3");
    heading.textContent = title + " Leaderboard";
    box.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "board-grid";
    boards.forEach(function(board) { grid.appendChild(board); });
    box.appendChild(grid);

    boardsArea.appendChild(box);
}

// A table of the top 20. Clicking the value heading switches between best first and worst first.
function makeBoard(title, items, extraTitle, format)
{
    const wrap = document.createElement("div");
    wrap.className = "board";

    const heading = document.createElement("h4");
    heading.className = "sub-title";
    heading.textContent = title;
    wrap.appendChild(heading);

    const table = document.createElement("table");
    table.className = "stats board-table";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");

    function th(text, className)
    {
        const cell = document.createElement("th");
        cell.textContent = text;
        cell.className = className || "";
        headRow.appendChild(cell);
        return cell;
    }

    th("#", "num");
    th("Team", "");

    if (extraTitle)
    {
        th(extraTitle, extraTitle === "League" ? "" : "num");
    }

    const valueHead = th("", "num sortable");
    valueHead.tabIndex = 0;
    valueHead.setAttribute("role", "button");

    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    table.appendChild(body);
    wrap.appendChild(table);

    let best = true;

    // every item with its real place (1 = best), so the worst view counts down from the bottom
    const ranked = items.slice().sort(function(a, b) {
        return (b.value - a.value) || a.name.localeCompare(b.name);
    });

    ranked.forEach(function(item, index) {
        item.place = index > 0 && ranked[index - 1].value === item.value ? ranked[index - 1].place : index + 1;
    });

    function render()
    {
        const sorted = (best ? ranked : ranked.slice().reverse()).slice(0, TOP);

        valueHead.textContent = (best ? "▼" : "▲") + " " + (title.indexOf("Wins") >= 0 ? "Wins" : "Pts");
        body.textContent = "";

        sorted.forEach(function(item) {
            const row = document.createElement("tr");

            function td(className)
            {
                const cell = document.createElement("td");
                cell.className = className || "";
                row.appendChild(cell);
                return cell;
            }

            td("num").textContent = String(item.place);

            const teamCell = td("");
            const link = document.createElement("a");
            link.href = "user.html?id=" + encodeURIComponent(item.uid);
            link.textContent = item.name;
            teamCell.appendChild(link);

            if (extraTitle === "League")
            {
                const leagueCell = td("");
                const leagueLink = document.createElement("a");
                leagueLink.href = "league.html?id=" + encodeURIComponent(item.leagueId);
                leagueLink.textContent = item.league;
                leagueCell.appendChild(leagueLink);
            }
            else if (extraTitle)
            {
                td("num").textContent = item.extra;
            }

            td("num").textContent = format(item.value);

            body.appendChild(row);
        });
    }

    function flip()
    {
        best = !best;
        render();
    }

    valueHead.addEventListener("click", flip);
    valueHead.addEventListener("keydown", function(event) {
        if (event.key === "Enter" || event.key === " ")
        {
            event.preventDefault();
            flip();
        }
    });

    render();

    return wrap;
}