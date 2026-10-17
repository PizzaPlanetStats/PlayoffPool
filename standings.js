// Pizza Planet - works out one team's standing in a league. No page or Firebase code in here, only maths.
//
//   P  = PP + GP + TP        total points
//   PP = player points       (each picked skater's stats times the league's points for each stat)
//   GP = goalie points       (the same for goalies)
//   TP = team points         points for the bracket prediction, worked out here from the results so far
//   PR = players remaining   picked skaters whose NHL team is still in the playoffs
//   GR = goalies remaining   picked goalies whose NHL team is still in the playoffs
//
// The stats themselves are saved once per player by the stats update, at leagues/{id}/stats/{playerId}:
//   { id, name, position, team, stats: { goals: 3, assists: 5, ... }, updatedAt }
// A player picked with the "Other" box has no NHL team on file, so they aren't counted in PR or GR.

import { normalizeCodes, cleanWinners, eliminationRounds, participants, roundStart, CHAMPION } from "./bracketLogic.js";
import { normalizeName } from "./nhlPlayers.js";
import { PREDICTION_POINTS } from "./predictions.js";

const ROUND_KEYS = PREDICTION_POINTS.map(function(prediction) { return prediction.key; });   // round1..round4, champion

// points for each elimination round 1 to 5 (5 = champion) from the league, or the standard points
function pointsByRound(league)
{
    const saved = league.predictionPoints || {};

    return PREDICTION_POINTS.map(function(prediction) {
        return typeof saved[prediction.key] === "number" ? saved[prediction.key] : prediction.points;
    });
}

// { BOS: 1, TOR: 5 } for the real results so far (teams still playing are left out)
export function actualRounds(league)
{
    const codes = normalizeCodes(league.playoffTeams);
    const winners = league.results && Array.isArray(league.results.winners) ? league.results.winners : [];

    return eliminationRounds(codes, cleanWinners(codes, winners));
}

// How the bracket prediction scored, team by team.
// A team knocked out in exactly the predicted round earns that round's points ("exact").
// One round off earns half the points of the lower round ("half"). Anything further off earns nothing ("miss").
// Teams still playing earn nothing yet and get no mark.
//
// returns { total, marks } where marks["MATCHINDEX:TEAMCODE"] = { kind, points, text, detail, title }.
// A mark sits on the team's slot in the match where the prediction says that team goes out
// (the loser of that match, and for the final also the winner, who is predicted to be champion).
export function predictionMarks(league, entryWinners)
{
    const codes = normalizeCodes(league.playoffTeams);
    const actual = actualRounds(league);
    const winners = cleanWinners(codes, entryWinners);
    const predicted = eliminationRounds(codes, winners);
    const worth = pointsByRound(league);

    const marks = {};
    let total = 0;

    for (let index = 0; index < winners.length; index++)
    {
        if (winners[index] === "")
        {
            continue;
        }

        const round = roundOfMatch(index);
        const teams = participants(codes, winners, round - 1, index - roundStart(round - 1));
        const loser = teams[0] === winners[index] ? teams[1] : teams[0];
        const slots = [loser];

        if (round === 4)
        {
            slots.push(winners[index]);   // the predicted champion
        }

        slots.forEach(function(code) {
            if (code === "" || actual[code] === undefined)
            {
                return;
            }

            const guess = predicted[code];
            const real = actual[code];
            let kind = "miss";
            let points = 0;

            if (guess === real)
            {
                kind = "exact";
                points = worth[real - 1];
            }
            else if (Math.abs(guess - real) === 1)
            {
                kind = "half";
                points = worth[Math.min(guess, real) - 1] / 2;
            }

            const outcome = real === CHAMPION ? "won it all" : "knocked out in round " + real;
            const guessed = guess === CHAMPION ? "champion" : "knocked out in round " + guess;

            marks[index + ":" + code] = {
                kind: kind,
                points: points,
                text: "+" + formatPoints(points),
                detail: real === CHAMPION ? "champion" : "eliminated R" + real,
                title: "Predicted: " + guessed + ". Real result: " + outcome + ". " + formatPoints(points) + " points."
            };

            total += points;
        });
    }

    return { total: total, marks: marks };
}

// just the bracket prediction total
export function teamPoints(league, entryWinners)
{
    return predictionMarks(league, entryWinners).total;
}

function roundOfMatch(index)
{
    return index < 8 ? 1 : index < 12 ? 2 : index < 14 ? 3 : 4;
}

// short column names for the stat tables (the full name is the tooltip)
export const SHORT_LABELS = {
    gamesPlayed: "GP", goals: "G", assists: "A", points: "P", plusMinus: "+/-", penaltyMinutes: "PIM",
    ppGoals: "PPG", ppPoints: "PPP", shGoals: "SHG", shPoints: "SHP", gameWinningGoals: "GWG", otGoals: "OTG", shots: "S",
    wins: "W", losses: "L", otLosses: "OTL", shutouts: "SO", saves: "SV", shotsAgainst: "SA", goalsAgainst: "GA"
};

// makes the look-up used to find a pick's saved stats. "docs" are the leagues/{id}/stats documents' data.
export function makeStatsLookup(docs)
{
    const lookup = { byId: {}, byName: {}, count: 0 };

    (docs || []).forEach(function(data) {
        if (!data || typeof data.stats !== "object" || data.stats === null)
        {
            return;
        }

        if (data.id)
        {
            lookup.byId[String(data.id)] = data;
        }

        lookup.byName[normalizeName(data.name || "")] = data;
        lookup.count++;
    });

    return lookup;
}

function findInList(nhl, name)
{
    const norm = normalizeName(name);

    return Array.isArray(nhl) ? nhl.find(function(player) { return player.norm === norm; }) : null;
}

function findStats(lookup, id, name)
{
    if (!lookup)
    {
        return null;
    }

    return (id !== "" && lookup.byId[id]) || lookup.byName[normalizeName(name)] || null;
}

// the points a player's stats are worth: every tracked stat times the points it is worth
function pointsFor(stats, worth)
{
    let total = 0;

    Object.keys(worth).forEach(function(key) {
        const value = stats ? Number(stats[key]) : 0;

        total += (Number.isFinite(value) ? value : 0) * worth[key];
    });

    return total;
}

// one line for each player group: who was picked, their NHL team, whether that team is still playing,
// and the stats and points they have earned.
export function describePicks(league, entry, actual, lookup, nhl)
{
    const groups = Array.isArray(league.playerGroups) ? league.playerGroups : [];
    const picks = entry && entry.players ? entry.players : {};
    const scoring = league.scoring || {};

    // only teams that are in this league's playoffs can still be playing
    const inPlayoffs = new Set(normalizeCodes(league.playoffTeams).filter(function(code) { return code !== ""; }));

    return groups.map(function(group, index) {
        const pick = picks[group.id] || null;
        const result = {
            group: "Group " + (index + 1), id: "", statDoc: null, name: "", team: "", goalie: false, alive: null, outRound: 0,
            other: false, notReal: false, hasStats: false, stats: {}, points: 0
        };

        if (!pick)
        {
            return result;
        }

        result.name = String(pick.name || "");

        // an "Other" pick made before the NHL team was saved with it: find the player in the NHL's list by name
        const known = pick.type === "other" && !pick.team ? findInList(nhl, result.name) : null;
        const pickId = String(pick.id || (known ? known.id : ""));
        const saved = findStats(lookup, pickId, result.name);
        result.id = pickId;
        result.statDoc = saved;

        if (pick.type === "other")
        {
            result.other = true;
            result.team = String(pick.team || (known && known.team) || (saved && saved.team) || "");
            result.goalie = pick.position === "G" || Boolean(known && known.position === "G") || Boolean(saved && saved.position === "G");
        }
        else
        {
            // the group has the position, the pick may be older than it
            const listed = (Array.isArray(group.players) ? group.players : []).find(function(player) {
                return (pickId !== "" && String(player.id || "") === pickId)
                    || normalizeName(player.name || "") === normalizeName(result.name);
            });

            result.team = String(pick.team || (listed && listed.team) || "");
            result.goalie = (listed ? listed.position === "G" : false) || (Boolean(saved) && saved.position === "G");
        }

        if (result.team !== "" && inPlayoffs.has(result.team))
        {
            const round = actual[result.team];

            result.alive = round === undefined || round === CHAMPION;
            result.outRound = round !== undefined && round !== CHAMPION ? round : 0;
        }
        else
        {
            // a team that isn't in the playoffs counts as out in round 1.
            // No NHL team at all means not a real player: no round, shown in gray.
            result.alive = false;
            result.notReal = result.team === "";
            result.outRound = result.notReal ? 0 : 1;
        }

        if (saved)
        {
            result.hasStats = true;
            result.stats = saved.stats;
            result.points = pointsFor(saved.stats, result.goalie ? (scoring.goalies || {}) : (scoring.skaters || {}));
        }
        else if (lookup && lookup.count > 0)
        {
            // the stats list loaded but this player isn't in it: they haven't played in the playoffs, so every stat is 0
            result.hasStats = true;
        }

        return result;
    });
}

// the admin's points adjustment for a team (leagues/{id}.adjustments = { teamId: points }), 0 when there is none
function adjustmentFor(league, uid)
{
    const value = league && league.adjustments && uid ? Number(league.adjustments[uid]) : 0;

    return Number.isFinite(value) ? value : 0;
}

// everything the standings table and a team's page need for one team.
// lookup = makeStatsLookup(...) of the saved player stats, or null before the first stats update
// nhl = the NHL player list (see nhlPlayers.js), used to find the team of "Other" picks that were saved without one; may be null
export function buildRow(league, entry, lookup, nhl, uid)
{
    const actual = actualRounds(league);
    const picks = describePicks(league, entry, actual, lookup, nhl);
    const prediction = predictionMarks(league, entry && entry.bracket ? entry.bracket.winners : []);

    const sum = function(list) {
        return list.reduce(function(total, pick) { return total + pick.points; }, 0);
    };

    const row = {
        playerPoints: sum(picks.filter(function(pick) { return !pick.goalie; })),
        goaliePoints: sum(picks.filter(function(pick) { return pick.goalie; })),
        adjustment: adjustmentFor(league, uid),
        teamPoints: prediction.total + adjustmentFor(league, uid),
        marks: prediction.marks,
        playersRemaining: picks.filter(function(pick) { return pick.alive === true && !pick.goalie; }).length,
        goaliesRemaining: picks.filter(function(pick) { return pick.alive === true && pick.goalie; }).length,
        picks: picks
    };

    row.total = row.playerPoints + row.goaliePoints + row.teamPoints;

    return row;
}

// best first. Teams with the same total share a place (1, 2, 2, 4).
export function rankRows(rows)
{
    rows.sort(function(a, b) {
        return (b.total - a.total) || a.name.localeCompare(b.name);
    });

    rows.forEach(function(row, index) {
        const before = rows[index - 1];
        row.place = before && before.total === row.total ? before.place : index + 1;
    });

    return rows;
}

// 954.7, 180, 0 (one decimal at most)
export function formatPoints(value)
{
    return String(Math.round(value * 10) / 10);
}