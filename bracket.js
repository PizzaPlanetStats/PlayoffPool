// Pizza Planet - draws the playoff bracket.
//
//   renderBracket(container, teams)                     just shows it (league page)
//   renderBracket(container, teams, { winners })        also shows the results so far
//   renderBracket(container, teams, { winners, onPick}) teams can be clicked to pick a winner (admin page)
//
// "teams" is the list of 16 team codes in bracket order, see bracketLogic.js for how the bracket works.

import { NHL_TEAMS } from "./nhlTeams.js";
import {
    TEAM_COUNT,
    ROUND_COUNT,
    matchesInRound,
    roundStart,
    normalizeCodes,
    participants,
    cleanWinners
} from "./bracketLogic.js";

const ROUND_NAMES = ["Round 1", "Round 2", "Round 3", "Round 4"];

export function renderBracket(container, savedCodes, options)
{
    const settings = options || {};
    const interactive = typeof settings.onPick === "function";

    container.textContent = "";

    const codes = normalizeCodes(savedCodes);

    const setCount = codes.filter(function(code) {
        return code !== "";
    }).length;

    if (setCount === 0)
    {
        const none = document.createElement("p");
        none.textContent = "The playoff teams haven't been set yet.";
        container.appendChild(none);
        return;
    }

    if (setCount < TEAM_COUNT)
    {
        const progress = document.createElement("p");
        progress.className = "hint";
        progress.textContent = setCount + " of " + TEAM_COUNT + " teams have clinched so far.";
        container.appendChild(progress);
    }

    // results that don't make sense (for example a team that was swapped out) are dropped
    const winners = cleanWinners(codes, settings.winners);

    const names = {};
    NHL_TEAMS.forEach(function(team) {
        names[team.code] = team.name;
    });

    // scrolls sideways on small screens
    const scroll = document.createElement("div");
    scroll.className = "scroll";

    const bracket = document.createElement("div");
    bracket.className = "bracket";

    for (let round = 0; round < ROUND_COUNT; round++)
    {
        const column = document.createElement("div");
        column.className = "bracket-round";

        const title = document.createElement("div");
        title.className = "bracket-title";
        title.textContent = ROUND_NAMES[round];

        const matches = document.createElement("div");
        matches.className = "bracket-matches";

        for (let m = 0; m < matchesInRound(round); m++)
        {
            const index = roundStart(round) + m;
            const teams = participants(codes, winners, round, m);
            const bothKnown = teams[0] !== "" && teams[1] !== "";

            const match = document.createElement("div");
            match.className = "bracket-match";

            teams.forEach(function(code) {
                const known = code !== "";
                const won = known && winners[index] === code;
                const lost = known && winners[index] !== "" && winners[index] !== code;

                const team = document.createElement(interactive ? "button" : "div");
                team.className = "bracket-team" + (known ? "" : " tbd") + (won ? " won" : "") + (lost ? " lost" : "");
                team.textContent = known ? (names[code] || code) : "TBD";

                if (interactive)
                {
                    team.type = "button";
                    team.disabled = !bothKnown;
                    team.setAttribute("aria-pressed", String(won));

                    team.addEventListener("click", function() {
                        settings.onPick(index, code);
                    });
                }

                match.appendChild(team);
            });

            matches.appendChild(match);
        }

        column.append(title, matches);
        bracket.appendChild(column);
    }

    scroll.appendChild(bracket);
    container.appendChild(scroll);
}