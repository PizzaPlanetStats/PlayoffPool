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
export async function loadStandings(leagueId, league, options)
{
    const live = Boolean(options && options.live);
    const entries = await getDocs(collection(db, "leagues", leagueId, "entries"));

    // team names are public. If they can't be read the rows just say "(unknown team)".
    const names = {};

    try
    {
        const teams = await getDocs(collection(db, "teams"));
        teams.forEach(function(teamDoc) {
            names[teamDoc.id] = String(teamDoc.data().teamName || "");
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

    // otherwise every player's playoff stats for this league's season, from the Worker (it asks the NHL and refreshes every 15 minutes).
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
        const row = buildRow(league, entryDoc.data(), lookup, nhl);

        row.uid = entryDoc.id;
        row.entry = entryDoc.data();
        row.name = names[entryDoc.id] || "(unknown team)";
        return row;
    });

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