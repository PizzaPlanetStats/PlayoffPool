// Pizza Planet - loads every registered team of a league and ranks them.
// Only works once the league has started (phase ongoing or ended): before that the rules keep other teams' picks private.

import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { buildRow, rankRows, makeStatsLookup } from "./standings.js";

// returns { rows, updated, hasStats }. rows is ranked: [{ uid, name, place, total, playerPoints, goaliePoints, teamPoints, playersRemaining, goaliesRemaining, picks, entry }]
// "updated" is when the stats were last updated (or null). Throws if the entries can't be read.
export async function loadStandings(leagueId, league)
{
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

    // the stats saved by the stats update, one document for each player picked in this league.
    // Nothing is there before the first update.
    const statDocs = [];
    let updated = null;

    try
    {
        const saved = await getDocs(collection(db, "leagues", leagueId, "stats"));

        saved.forEach(function(statDoc) {
            const data = statDoc.data();
            statDocs.push(data);

            const when = data.updatedAt && typeof data.updatedAt.toDate === "function" ? data.updatedAt.toDate() : null;

            if (when && (!updated || when > updated))
            {
                updated = when;
            }
        });
    }
    catch (err)
    {
        // keep going: the stats just show as not updated yet
    }

    const lookup = makeStatsLookup(statDocs);

    const rows = entries.docs.map(function(entryDoc) {
        const row = buildRow(league, entryDoc.data(), lookup);

        row.uid = entryDoc.id;
        row.entry = entryDoc.data();
        row.name = names[entryDoc.id] || "(unknown team)";
        return row;
    });

    return { rows: rankRows(rows), updated: updated, hasStats: lookup.count > 0 };
}