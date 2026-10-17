// Pizza Planet - a team's league history and stats (used by user.html)
// Built from the saved final standings (Save Stats) of every league that has ended.

import { db } from "./firebase.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { leaguePhase } from "./phases.js";

// one item per ended league this team was in, newest league first:
// [{ leagueId, leagueName, year, place, total, playerPoints, goaliePoints, teamPoints }]
export async function loadSeasons(teamId)
{
    const leagues = await getDocs(collection(db, "leagues"));

    const ended = leagues.docs.filter(function(leagueDoc) {
        return leaguePhase(leagueDoc.data()) === "ended";
    });

    const found = await Promise.all(ended.map(async function(leagueDoc) {
        const snap = await getDoc(doc(db, "leagues", leagueDoc.id, "final", "standings"));
        const rows = snap.exists() ? (snap.data().standings || []) : [];
        const row = rows.find(function(candidate) { return String(candidate.uid) === teamId; });

        if (!row)
        {
            return null;
        }

        const data = leagueDoc.data();

        return {
            leagueId: leagueDoc.id, leagueName: String(data.name || (data.year + " League")), year: Number(data.year) || 0,
            place: Number(row.place) || 0, total: Number(row.total) || 0, playerPoints: Number(row.playerPoints) || 0,
            goaliePoints: Number(row.goaliePoints) || 0, teamPoints: Number(row.teamPoints) || 0
        };
    }));

    return found.filter(Boolean).sort(function(a, b) {
        return (b.year - a.year) || a.leagueName.localeCompare(b.leagueName);
    });
}

// the numbers shown in the Stats box
export function computeStats(seasons)
{
    const count = seasons.length;
    const places = seasons.map(function(season) { return season.place; });
    const placed = function(n) { return places.filter(function(place) { return place === n; }).length; };

    const kinds = ["total", "playerPoints", "goaliePoints", "teamPoints"].map(function(key) {
        const values = seasons.map(function(season) { return season[key]; });
        const sum = values.reduce(function(a, b) { return a + b; }, 0);
        const best = Math.max.apply(null, values);

        return { key: key, sum: sum, average: sum / count, best: best, bestLeague: seasons[values.indexOf(best)].leagueName };
    });

    return {
        leagues: count,
        first: placed(1), second: placed(2), third: placed(3),
        podiumPoints: placed(1) * 3 + placed(2) * 2 + placed(3),
        winRate: placed(1) / count * 100,
        averageFinish: places.reduce(function(a, b) { return a + b; }, 0) / count,
        bestFinish: Math.min.apply(null, places),
        kinds: kinds
    };
}