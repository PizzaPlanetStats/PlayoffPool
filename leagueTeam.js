// Pizza Planet - one team's picks in one league (leagueTeam.html?id=LEAGUE_ID&team=TEAM_ID)
//
// Who can see what (the real protection is in firestore.rules, this only decides what the page shows):
//   - registration still going (phases 1 and 2): a team sees only its own picks, and only after it has registered
//   - league ongoing or ended (phases 3 and 4): everyone can see every team's picks
//   - the admin can always see them
//
// Team names are typed in by people, so everything is shown with textContent, never as HTML.

import { auth, db, isAdmin, onAuthStateChanged } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { renderBracket } from "./bracket.js";
import { normalizeCodes, cleanWinners } from "./bracketLogic.js";
import { leaguePhase } from "./phases.js";
import { appendSuffix } from "./suffixes.js";
import { buildRow, formatPoints, makeStatsLookup, SHORT_LABELS } from "./standings.js";
import { SKATER_STATS, GOALIE_STATS } from "./stats.js";
import { loadStandings } from "./leagueStandings.js";
import { loadKnownPlayers } from "./nhlPlayers.js";

const status = document.getElementById("status");
const teamArea = document.getElementById("team-area");
const logoBox = document.getElementById("logo-box");
const teamName = document.getElementById("team-name");
const teamSub = document.getElementById("team-sub");
const teamLinks = document.getElementById("team-links");
const playersTable = document.getElementById("players-table");
const goaliesTable = document.getElementById("goalies-table");
const totalPoints = document.getElementById("total-points");
const bracketTotal = document.getElementById("bracket-total");
const adjustTotal = document.getElementById("adjust-total");
const bracketBox = document.getElementById("bracket");

const params = new URLSearchParams(location.search);
const leagueId = params.get("id");
const wantedTeam = params.get("team");

onAuthStateChanged(auth, function(user) {

    show(user);
});

// only the first answer from Firebase matters here (the page doesn't need to redraw on later sign-ins)
let shown = false;

function message(text)
{
    status.textContent = text;
    status.classList.remove("hidden");
    teamArea.classList.add("hidden");
}

function addLink(text, href)
{
    if (teamLinks.childNodes.length > 0)
    {
        teamLinks.appendChild(document.createTextNode(" "));
    }

    const link = document.createElement("a");
    link.className = "btn small";
    link.href = href;
    link.textContent = text;
    teamLinks.appendChild(link);
}

async function show(user)
{
    if (shown)
    {
        return;
    }

    shown = true;

    if (!leagueId || !/^[A-Za-z0-9]{1,40}$/.test(leagueId))
    {
        message("League not found.");
        return;
    }

    let league;

    try
    {
        const snap = await getDoc(doc(db, "leagues", leagueId));

        if (!snap.exists())
        {
            message("League not found.");
            return;
        }

        league = snap.data();
    }
    catch (err)
    {
        message("Could not load this league. Try again later.");
        return;
    }

    const phase = leaguePhase(league);
    const leagueName = String(league.name || (league.year + " League"));
    const underway = phase === "ongoing" || phase === "ended";
    const admin = user ? await isAdmin(user) : false;

    // no team in the address means "my team"
    const teamId = wantedTeam || (user ? user.uid : "");

    if (!/^[A-Za-z0-9]{1,128}$/.test(teamId))
    {
        message(user ? "Team not found." : "Sign in to see your picks, or open a team from the league's standings.");
        return;
    }

    const isMine = Boolean(user) && user.uid === teamId;

    if (!underway && !isMine && !admin)
    {
        message(user
            ? "Other teams' picks stay hidden until registration closes and the league is underway."
            : "Sign in to see your own picks. Other teams' picks stay hidden until registration closes and the league is underway.");
        return;
    }

    // the team's name (public) and its entry in this league
    let name = "(unknown team)";
    let suffix = "";

    try
    {
        const teamSnap = await getDoc(doc(db, "teams", teamId));

        if (teamSnap.exists() && teamSnap.data().teamName)
        {
            name = String(teamSnap.data().teamName);
        }

        if (teamSnap.exists() && teamSnap.data().suffix)
        {
            suffix = String(teamSnap.data().suffix);
        }
    }
    catch (err)
    {
        // keep the placeholder name
    }

    let row = null;
    let statsInfo = { updated: null, hasStats: false };

    try
    {
        if (underway)
        {
            // the standings include this team's place, so load them all
            const result = await loadStandings(leagueId, league);
            row = result.rows.find(function(candidate) { return candidate.uid === teamId; }) || null;
            statsInfo = result;
        }
        else
        {
            const entrySnap = await getDoc(doc(db, "leagues", leagueId, "entries", teamId));

            if (entrySnap.exists())
            {
                row = buildRow(league, entrySnap.data(), null, await loadKnownPlayers(league.year), teamId);
                row.entry = entrySnap.data();
            }
        }
    }
    catch (err)
    {
        message("Could not load the picks. Try again later.");
        return;
    }

    if (!row)
    {
        message(isMine
            ? "You haven't registered in " + leagueName + " yet."
            : "This team isn't registered in " + leagueName + ".");

        if (isMine && phase === "open")
        {
            status.appendChild(document.createTextNode(" "));
            const link = document.createElement("a");
            link.href = "register.html?id=" + encodeURIComponent(leagueId);
            link.textContent = "Register now";
            status.appendChild(link);
        }

        return;
    }

    document.title = name + " - " + leagueName + " - Pizza Planet";
    teamName.textContent = name;
    appendSuffix(teamName, suffix);
    teamSub.textContent = leagueName;

    // the logo is a PNG named TEAMID.png in the project root
    const logo = document.createElement("img");
    logo.alt = "";
    logo.addEventListener("error", function() { logo.remove(); });
    logo.src = encodeURIComponent(teamId) + ".png";
    logoBox.appendChild(logo);

    addLink("League Home", "league.html?id=" + encodeURIComponent(leagueId));

    if (isMine && phase === "open")
    {
        addLink("Edit Registration", "register.html?id=" + encodeURIComponent(leagueId));
    }

    const scoring = league.scoring || {};

    drawPickTable(playersTable, row.picks.filter(function(pick) { return !pick.goalie; }), SKATER_STATS, scoring.skaters || {}, "Player", "No players picked.");
    drawPickTable(goaliesTable, row.picks.filter(function(pick) { return pick.goalie; }), GOALIE_STATS, scoring.goalies || {}, "Goalie", "No goalies picked.");

    totalPoints.textContent = formatPoints(row.total);
    bracketTotal.textContent = "Team points: " + formatPoints(row.teamPoints);

    // points the admin added or removed (for example the 2020 qualifier and round robin)
    if (row.adjustment !== 0 || Number(league.year) === 2020)
    {
        adjustTotal.textContent = "Qualifier and Round Robin points: " + formatPoints(row.adjustment);
        adjustTotal.classList.remove("hidden");
    }

    const codes = normalizeCodes(league.playoffTeams);
    const winners = row.entry && row.entry.bracket ? cleanWinners(codes, row.entry.bracket.winners) : [];

    renderBracket(bracketBox, league.playoffTeams, { winners: winners, marks: row.marks });

    status.classList.add("hidden");
    teamArea.classList.remove("hidden");
}

// a table like the old spreadsheet: one row per pick with the stats the league scores, then the points they earned.
// The row colour shows how far the player's NHL team got. The last two rows are the stat totals and the final total.
function drawPickTable(container, picks, statList, worth, firstTitle, emptyText)
{
    container.textContent = "";

    if (picks.length === 0)
    {
        const none = document.createElement("p");
        none.textContent = emptyText;
        container.appendChild(none);
        return;
    }

    const columns = statList.filter(function(stat) {
        return Object.prototype.hasOwnProperty.call(worth, stat.key);
    });

    const wrapper = document.createElement("div");
    wrapper.className = "scroll";

    const table = document.createElement("table");
    table.className = "stats pick-table";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");

    const titles = [{ text: firstTitle, tip: "" }].concat(columns.map(function(stat) {
        return { text: SHORT_LABELS[stat.key] || stat.label, tip: stat.label + " (" + worth[stat.key] + " points each)" };
    }), [{ text: "Pts", tip: "Points earned" }]);

    titles.forEach(function(title, index) {
        const th = document.createElement("th");
        th.textContent = title.text;
        th.title = title.tip;

        if (index > 0)
        {
            th.className = "num";
        }

        headRow.appendChild(th);
    });

    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    const totals = columns.map(function() { return 0; });
    let anyStats = false;
    let pointsTotal = 0;

    picks.forEach(function(pick) {
        const tr = document.createElement("tr");

        if (pick.notReal)
        {
            tr.className = "not-real";
        }
        else if (pick.outRound >= 1 && pick.outRound <= 4)
        {
            tr.className = "elim-" + pick.outRound;
        }

        const nameCell = document.createElement("td");
        nameCell.textContent = (pick.name || "(no pick)") + (pick.team ? " (" + pick.team + ")" : "");
        tr.appendChild(nameCell);

        columns.forEach(function(stat, index) {
            const td = document.createElement("td");
            td.className = "num";

            if (pick.hasStats)
            {
                const value = Number(pick.stats[stat.key]);
                const shown = Number.isFinite(value) ? value : 0;

                td.textContent = formatPoints(shown);
                totals[index] += shown;
                anyStats = true;
            }
            else
            {
                td.textContent = "-";
            }

            tr.appendChild(td);
        });

        const pointsCell = document.createElement("td");
        pointsCell.className = "num points-cell";
        pointsCell.textContent = pick.hasStats ? formatPoints(pick.points) : "-";
        tr.appendChild(pointsCell);

        pointsTotal += pick.points;
        body.appendChild(tr);
    });

    table.appendChild(body);

    const foot = document.createElement("tfoot");
    const totalRow = document.createElement("tr");
    const totalLabel = document.createElement("td");
    totalLabel.textContent = "Total";
    totalRow.appendChild(totalLabel);

    totals.forEach(function(total) {
        const td = document.createElement("td");
        td.className = "num";
        td.textContent = anyStats ? formatPoints(total) : "-";
        totalRow.appendChild(td);
    });

    const totalPoints = document.createElement("td");
    totalPoints.className = "num points-cell";
    totalPoints.textContent = formatPoints(pointsTotal);
    totalRow.appendChild(totalPoints);
    foot.appendChild(totalRow);
    table.appendChild(foot);

    wrapper.appendChild(table);
    container.appendChild(wrapper);
}