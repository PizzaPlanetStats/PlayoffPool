// Pizza Planet - a team's league history and stats (used by user.html)
// Built from the saved final standings (Save Stats) of every league that has ended.

import { db } from "./firebase.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { leaguePhase } from "./phases.js";
import { normalizeCodes, cleanWinners } from "./bracketLogic.js";

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

// The players, goalies and NHL teams a team has picked most, from its registrations in every league that has started
// (before that, other people can't read the picks). Each list is [{ name, count }], biggest first, top 3.
// Teams are counted by how many series they were picked to win across the bracket.
export async function loadFavourites(teamId)
{
    const leagues = await getDocs(collection(db, "leagues"));

    const started = leagues.docs.filter(function(leagueDoc) {
        const phase = leaguePhase(leagueDoc.data());
        return phase === "ongoing" || phase === "ended";
    });

    const players = {};
    const goalies = {};
    const teams = {};

    function add(table, key, name)
    {
        const item = table[key] || (table[key] = { name: name, count: 0 });
        item.count++;
    }

    await Promise.all(started.map(async function(leagueDoc) {
        const snap = await getDoc(doc(db, "leagues", leagueDoc.id, "entries", teamId));

        if (!snap.exists())
        {
            return;
        }

        const league = leagueDoc.data();
        const entry = snap.data();
        const groups = Array.isArray(league.playerGroups) ? league.playerGroups : [];
        const picks = entry.players || {};

        groups.forEach(function(group) {
            const pick = picks[group.id];

            if (!pick || !pick.name)
            {
                return;
            }

            let goalie = pick.position === "G";

            if (pick.type !== "other")
            {
                const listed = (group.players || []).find(function(player) {
                    return String(player.id || "") === String(pick.id || "") || player.name === pick.name;
                });

                goalie = Boolean(listed) && listed.position === "G";
            }

            const key = pick.id ? "id" + pick.id : String(pick.name).toLowerCase();
            add(goalie ? goalies : players, key, String(pick.name));
        });

        const codes = normalizeCodes(league.playoffTeams);
        const winners = entry.bracket ? cleanWinners(codes, entry.bracket.winners) : [];

        winners.forEach(function(code) {
            if (code !== "")
            {
                add(teams, code, code);
            }
        });
    }));

    function top(table)
    {
        return Object.values(table).sort(function(a, b) {
            return (b.count - a.count) || a.name.localeCompare(b.name);
        }).slice(0, 3);
    }

    return { players: top(players), goalies: top(goalies), teams: top(teams) };
}