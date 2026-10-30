// Pizza Planet - export an ended league's saved stats to an Excel file (used by league.html)
// Everything comes from the saved copy (Save Stats), so the file always matches the standings on the page.
// The Excel writer (SheetJS) is only downloaded when the button is pressed.

import { loadStandings } from "./leagueStandings.js";
import { SKATER_STATS, GOALIE_STATS } from "./stats.js";

const SHEETJS = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

function loadSheetJs()
{
    if (window.XLSX)
    {
        return Promise.resolve(window.XLSX);
    }

    return new Promise(function(resolve, reject) {
        const script = document.createElement("script");
        script.src = SHEETJS;
        script.onload = function() { resolve(window.XLSX); };
        script.onerror = function() { reject(new Error("Could not load the Excel library.")); };
        document.head.appendChild(script);
    });
}

function statSheet(XLSX, players, statList, goalie)
{
    const rows = players.filter(function(player) {
        return (player.position === "G") === goalie;
    }).map(function(player) {
        const line = { Player: player.name, Team: player.team || "" };

        statList.forEach(function(stat) {
            line[stat.label] = Number(player.stats && player.stats[stat.key]) || 0;
        });

        return line;
    });

    return rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : null;
}

// one team's page: its place and points, then its player picks and goalie picks with the stats that are scored and the points each earned
function teamSheet(XLSX, league, row)
{
    const scoring = league.scoring || {};
    const lines = [[row.name], ["Place", row.place], []];

    [["Player Picks", false, SKATER_STATS, scoring.skaters || {}, "Player Points", row.playerPoints],
     ["Goalie Picks", true, GOALIE_STATS, scoring.goalies || {}, "Goalie Points", row.goaliePoints]].forEach(function(part) {
        const tracked = part[2].filter(function(stat) { return Object.prototype.hasOwnProperty.call(part[3], stat.key); });
        const picks = row.picks.filter(function(pick) { return pick.name !== "" && pick.goalie === part[1]; });

        lines.push([part[0]]);
        lines.push(["Group", "Pick", "NHL Team"].concat(tracked.map(function(stat) { return stat.label; }), ["Points"]));

        picks.forEach(function(pick) {
            lines.push([pick.group, pick.name, pick.team].concat(tracked.map(function(stat) {
                return Number(pick.stats && pick.stats[stat.key]) || 0;
            }), [pick.points]));
        });

        lines.push(["Total", "", ""].concat(tracked.map(function() { return ""; }), [part[5]]));
        lines.push([]);
    });

    lines.push(["Team Points", row.teamPoints]);
    lines.push([]);
    lines.push(["Total Points", row.total]);

    return XLSX.utils.aoa_to_sheet(lines);
}

// a sheet name Excel accepts (31 letters at most, no : \ / ? * [ ]) that no other sheet has
function sheetName(name, used)
{
    const base = String(name).replace(/[:\\/?*\[\]]/g, "").trim().slice(0, 28) || "Team";
    let candidate = base;
    let n = 2;

    while (used.has(candidate.toLowerCase()))
    {
        candidate = base + " " + n++;
    }

    used.add(candidate.toLowerCase());
    return candidate;
}

// builds and downloads the file. Throws if the saved data or the Excel library can't be loaded.
export async function exportLeague(leagueId, league)
{
    const XLSX = await loadSheetJs();
    const result = await loadStandings(leagueId, league);

    const standings = result.rows.map(function(row) {
        return {
            Place: row.place, Team: row.name, Points: row.total, "Player Points": row.playerPoints,
            "Goalie Points": row.goaliePoints, "Team Points": row.teamPoints,
            "Players Remaining": row.playersRemaining, "Goalies Remaining": row.goaliesRemaining
        };
    });

    const picks = [];

    result.rows.forEach(function(row) {
        row.picks.forEach(function(pick) {
            if (pick.name === "")
            {
                return;
            }

            picks.push({
                Place: row.place, Team: row.name, Group: pick.group, Pick: pick.name, "NHL Team": pick.team,
                Type: pick.goalie ? "Goalie" : "Player", Points: pick.points
            });
        });
    });

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(standings), "Standings");

    if (picks.length > 0)
    {
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(picks), "Picks");
    }

    const used = new Set(["standings", "picks", "player stats", "goalie stats"]);

    result.rows.forEach(function(row) {
        XLSX.utils.book_append_sheet(book, teamSheet(XLSX, league, row), sheetName(row.name, used));
    });

    const skaters = statSheet(XLSX, result.players, SKATER_STATS, false);
    const goalies = statSheet(XLSX, result.players, GOALIE_STATS, true);

    if (skaters)
    {
        XLSX.utils.book_append_sheet(book, skaters, "Player Stats");
    }

    if (goalies)
    {
        XLSX.utils.book_append_sheet(book, goalies, "Goalie Stats");
    }

    const name = String(league.name || (league.year + " League")).replace(/[^A-Za-z0-9 _-]/g, "").trim() || "league";
    XLSX.writeFile(book, name + ".xlsx");
}