// Pizza Planet - loads every registered team of a league and ranks them.
// Only works once the league has started (phase ongoing or ended): before that the rules keep other teams' picks private.

import { db } from "./firebase.js";
import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { buildRow, rankRows, makeStatsLookup } from "./standings.js";
import { loadKnownPlayers, loadPlayoffStats } from "./nhlPlayers.js";
import { leaguePhase } from "./phases.js";

// While the league is on, the stats come live from the Worker. Once the league has ended and the admin has pressed Save Stats,
// the saved copy at leagues/{id}/final/stats is used instead (one read, and it can't change if the NHL's data does).
// Pass { live: true } to ignore the saved copy (the Save Stats button does).
//
// returns { rows, updated, hasStats, saved, players }. rows is ranked: [{ uid, name, place, total, playerPoints, goaliePoints, teamPoints, playersRemaining, goaliesRemaining, picks, entry }]
// "updated" is when the stats were last updated (or null). Throws if the entries can't be read.
//
// { summary: true } is for the league's standings table, which only needs the totals. Once a league has ended and its final standings have been
// saved, the table is built from that saved copy alone (the picks, the stats and the NHL are not touched, and nothing is worked out again).
// The rows then only have uid, name, suffix, place and the points columns, so team pages don't use this.
export async function loadStandings(leagueId, league, options)
{
    const live = Boolean(options && options.live);

    if (options && options.summary && !live && leaguePhase(league) === "ended")
    {
        const frozen = await loadFrozenStandings(leagueId);

        if (frozen)
        {
            return frozen;
        }
    }

    const entries = await getDocs(collection(db, "leagues", leagueId, "entries"));

    // team names are public. If they can't be read the rows just say "(unknown team)".
    const names = {};
    const suffixes = {};

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
        // keep going without names
    }

    let statDocs = [];
    let updated = null;
    let saved = false;

    // the saved copy, for a league that has ended
    if (!live && leaguePhase(league) === "ended")
    {
        try
        {
            const snap = await getDoc(doc(db, "leagues", leagueId, "final", "stats"));

            if (snap.exists() && Array.isArray(snap.data().players))
            {
                statDocs = snap.data().players;
                const when = snap.data().savedAt;
                updated = when && typeof when.toDate === "function" ? when.toDate() : null;
                saved = true;
            }
        }
        catch (err)
        {
            console.warn("Saved stats problem:", err);
        }
    }

    // otherwise every player's playoff stats for this league's season, from the Worker (it asks the NHL and refreshes every 5 minutes).
    // If it can't be loaded the stats just show as dashes.
    if (!saved)
    {
        try
        {
            const stats = await loadPlayoffStats(league.year);

            statDocs = stats.players;
            updated = stats.generatedAt;
        }
        catch (err)
        {
            console.warn("Playoff stats problem:", err);
        }
    }

    const lookup = makeStatsLookup(statDocs);

    // the NHL list finds the team of "Other" picks. If it can't be loaded those players just show without a team.
    // (A saved copy already has the team of every picked player, so it isn't needed then.)
    const nhl = saved ? [] : await loadKnownPlayers(league.year);

    const rows = entries.docs.map(function(entryDoc) {
        const row = buildRow(league, entryDoc.data(), lookup, nhl, entryDoc.id);

        row.uid = entryDoc.id;
        row.entry = entryDoc.data();
        row.name = names[entryDoc.id] || "(unknown team)";
        row.suffix = suffixes[entryDoc.id] || "";
        return row;
    });

    // an ended league keeps the numbers that were saved with its final standings, so a team's page always agrees with the table
    if (!live && leaguePhase(league) === "ended")
    {
        try
        {
            const snap = await getDoc(doc(db, "leagues", leagueId, "final", "standings"));
            const savedRows = snap.exists() && Array.isArray(snap.data().standings) ? snap.data().standings : [];

            rows.forEach(function(row) {
                const frozen = savedRows.find(function(candidate) { return String(candidate.uid) === row.uid; });

                if (frozen)
                {
                    ["playerPoints", "goaliePoints", "teamPoints", "playersRemaining", "goaliesRemaining"].forEach(function(key) {
                        if (Number.isFinite(Number(frozen[key])))
                        {
                            row[key] = Number(frozen[key]);
                        }
                    });

                    row.total = row.playerPoints + row.goaliePoints + row.teamPoints;
                }
            });
        }
        catch (err)
        {
            console.warn("Saved standings problem:", err);
        }
    }

    // the stat lines of the players that were actually picked (what Save Stats keeps)
    const picked = new Map();

    rows.forEach(function(row) {
        row.picks.forEach(function(pick) {
            if (pick.statDoc)
            {
                picked.set(String(pick.statDoc.id) + "|" + pick.statDoc.name, pick.statDoc);
            }
        });
    });

    return { rows: rankRows(rows), updated: updated, hasStats: lookup.count > 0, saved: saved, players: Array.from(picked.values()) };
}

// the final standings saved by Save Stats, as rows for the standings table. null when there is no saved copy.
async function loadFrozenStandings(leagueId)
{
    try
    {
        const snap = await getDoc(doc(db, "leagues", leagueId, "final", "standings"));

        if (!snap.exists() || !Array.isArray(snap.data().standings) || snap.data().standings.length === 0)
        {
            return null;
        }

        const names = {};
        const suffixes = {};

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
            // the names saved with the standings are used instead
        }

        const num = function(value) { return Number(value) || 0; };

        const rows = snap.data().standings.map(function(saved) {
            return {
                uid: String(saved.uid), name: names[saved.uid] || String(saved.name || "(unknown team)"), suffix: suffixes[saved.uid] || "",
                place: num(saved.place), total: num(saved.total), playerPoints: num(saved.playerPoints), goaliePoints: num(saved.goaliePoints),
                teamPoints: num(saved.teamPoints), playersRemaining: num(saved.playersRemaining), goaliesRemaining: num(saved.goaliesRemaining)
            };
        }).sort(function(a, b) {
            return (a.place - b.place) || a.name.localeCompare(b.name);
        });

        const when = snap.data().savedAt;

        return { rows: rows, updated: when && typeof when.toDate === "function" ? when.toDate() : null, hasStats: true, saved: true, players: [] };
    }
    catch (err)
    {
        console.warn("Saved standings problem:", err);
        return null;
    }
}