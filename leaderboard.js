// Pizza Planet - leaderboards (leaderboard.html)
// Built from the saved final standings (Save Stats) of every league that has ended.
// Team names are typed in by users, so everything is shown with textContent, never as HTML.

import { db } from "./firebase.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { leaguePhase } from "./phases.js";
import { formatPoints } from "./standings.js";
import { appendSuffix } from "./suffixes.js";

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
    let suffixes = {};

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
            teams.forEach(function(teamDoc) {
                names[teamDoc.id] = String(teamDoc.data().teamName || "");
                suffixes[teamDoc.id] = String(teamDoc.data().suffix || "");
            });
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
                    uid: String(row.uid), name: names[row.uid] || String(row.name || "(unknown team)"), suffix: suffixes[row.uid] || "",
                    leagueId: item.league.id, leagueName: leagueName, year: Number(data.year) || 0, place: Number(row.place) || 0,
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
            team = { uid: entry.uid, name: entry.name, suffix: entry.suffix, leagues: 0, wins: 0, second: 0, third: 0, podium: 0, total: 0, playerPoints: 0, goaliePoints: 0, teamPoints: 0 };
            map.set(entry.uid, team);
        }

        team.leagues++;
        team.wins += entry.place === 1 ? 1 : 0;
        team.second += entry.place === 2 ? 1 : 0;
        team.third += entry.place === 3 ? 1 : 0;
        team.podium += entry.place === 1 ? 3 : entry.place === 2 ? 2 : entry.place === 3 ? 1 : 0;
        KINDS.forEach(function(kind) { team[kind.key] += entry[kind.key]; });
    });

    return Array.from(map.values());
}

function draw(entries)
{
    const teams = perTeam(entries);

    addGroup("", [
        makeBoard("League Wins", teams.map(function(t) { return { uid: t.uid, name: t.name, suffix: t.suffix, value: t.wins }; }), null, whole, "Wins"),
        makeBoard("League Podium Points", teams.map(function(t) {
            return { uid: t.uid, name: t.name, suffix: t.suffix, extras: [String(t.wins), String(t.second), String(t.third)], value: t.podium };
        }), ["1st", "2nd", "3rd"], whole, "Pts"),
        makeBoard("Leagues Played", teams.map(function(t) { return { uid: t.uid, name: t.name, suffix: t.suffix, value: t.leagues }; }), null, whole, "Leagues"),
        makeBoard("League Win Rate", teams.map(function(t) {
            return { uid: t.uid, name: t.name, suffix: t.suffix, extras: [String(t.wins), String(t.leagues)], value: t.wins / t.leagues * 100 };
        }), ["Wins", "Leagues"], function(value) { return formatPoints(value) + "%"; }, "Rate")
    ]);

    addGroup("Single Season", KINDS.map(function(kind) {
        return makeBoard(kind.label, entries.map(function(e) {
            return { uid: e.uid, name: e.name, suffix: e.suffix, league: e.year ? String(e.year) : e.leagueName, leagueId: e.leagueId, value: e[kind.key] };
        }), "League", formatPoints);
    }));

    addGroup("All Time", KINDS.map(function(kind) {
        return makeBoard(kind.label, teams.map(function(t) {
            return { uid: t.uid, name: t.name, suffix: t.suffix, extra: String(t.leagues), value: t[kind.key] };
        }), "Leagues", formatPoints);
    }));

    addGroup("Average Points", KINDS.map(function(kind) {
        return makeBoard(kind.label, teams.map(function(t) {
            return { uid: t.uid, name: t.name, suffix: t.suffix, extra: String(t.leagues), value: t[kind.key] / t.leagues };
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

    if (title)
    {
        const heading = document.createElement("h3");
        heading.textContent = title + " Leaderboard";
        box.appendChild(heading);
    }

    const grid = document.createElement("div");
    grid.className = "board-grid";
    boards.forEach(function(board) { grid.appendChild(board); });
    box.appendChild(grid);

    boardsArea.appendChild(box);
}

// A table of the top 20 (a button shows the whole list when there are more). Clicking the value heading switches between best first and worst first.
function makeBoard(title, items, extraTitle, format, valueLabel)
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

    // extra columns: "League" is a link to the league, anything else is a number column (a list of titles gives several)
    const extraCols = Array.isArray(extraTitle) ? extraTitle : (extraTitle && extraTitle !== "League" ? [extraTitle] : []);

    if (extraTitle === "League")
    {
        th("Year", "num");
    }

    extraCols.forEach(function(title) { th(title, "num"); });

    const valueHead = th("", "num sortable");
    valueHead.tabIndex = 0;
    valueHead.setAttribute("role", "button");

    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    table.appendChild(body);
    wrap.appendChild(table);

    let best = true;
    let showAll = false;

    // every item with its real place (1 = best), so the worst view counts down from the bottom
    const ranked = items.slice().sort(function(a, b) {
        return (b.value - a.value) || a.name.localeCompare(b.name);
    });

    ranked.forEach(function(item, index) {
        item.place = index > 0 && ranked[index - 1].value === item.value ? ranked[index - 1].place : index + 1;
    });

    function render()
    {
        const sorted = (best ? ranked : ranked.slice().reverse()).slice(0, showAll ? ranked.length : TOP);

        valueHead.textContent = (best ? "▼" : "▲") + " " + (valueLabel || "Pts");
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
            appendSuffix(teamCell, item.suffix);

            if (extraTitle === "League")
            {
                const leagueCell = td("num");
                const leagueLink = document.createElement("a");
                leagueLink.href = "league.html?id=" + encodeURIComponent(item.leagueId);
                leagueLink.textContent = item.league;
                leagueCell.appendChild(leagueLink);
            }
            else
            {
                (item.extras || (extraCols.length ? [item.extra] : [])).forEach(function(text) { td("num").textContent = text; });
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

    // a longer list can be opened up in full, to find where you are in the middle of it
    if (items.length > TOP)
    {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "btn small";
        more.textContent = "Show All";
        more.addEventListener("click", function() {
            showAll = !showAll;
            more.textContent = showAll ? "Show Top " + TOP : "Show All";
            render();
        });

        const moreWrap = document.createElement("p");
        moreWrap.className = "board-more";
        moreWrap.appendChild(more);
        wrap.appendChild(moreWrap);
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