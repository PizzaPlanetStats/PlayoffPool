// Pizza Planet - the rules of the playoff bracket (no page code in here).
//
// Teams: a list of 16 team codes in BRACKET ORDER ("" = not set yet).
//   Round 1 has 8 matches: positions 1 v 2, 3 v 4, 5 v 6, and so on.
//   Round 2 has 4 matches: the winners of round 1 matches 1 v 2, 3 v 4, and so on.
//   Round 3 has 2 matches and round 4 (the final) has 1.
//
// Winners: a list of 15 team codes, one for each match ("" = not decided yet), in this order:
//   0-7 round 1, 8-11 round 2, 12-13 round 3, 14 the final.
//
// A team is knocked out in the round it loses (1 to 4). The winner of the final is the champion.

export const TEAM_COUNT = 16;
export const MATCH_COUNT = 15;
export const ROUND_COUNT = 4;
export const CHAMPION = 5;   // used in place of a round number for the team that wins it all

const ROUND_START = [0, 8, 12, 14];   // where each round begins in the winners list

// how many matches there are in a round (round 0 is the first round)
export function matchesInRound(round)
{
    return 8 >> round;
}

// the position of a round's first match in the winners list
export function roundStart(round)
{
    return ROUND_START[round];
}

// always exactly 16 entries, "" for any that are missing
export function normalizeCodes(saved)
{
    const codes = [];

    for (let i = 0; i < TEAM_COUNT; i++)
    {
        codes.push(Array.isArray(saved) && typeof saved[i] === "string" ? saved[i] : "");
    }

    return codes;
}

// the two teams in a match ("" for a team that is not known yet)
export function participants(codes, winners, round, match)
{
    if (round === 0)
    {
        return [codes[match * 2], codes[match * 2 + 1]];
    }

    const feeder = ROUND_START[round - 1] + match * 2;
    return [winners[feeder], winners[feeder + 1]];
}

// returns exactly 15 winners where each one is "" or one of that match's two teams.
// A winner only counts if both teams are known, so changing an earlier result or a team
// quietly removes any later result that no longer makes sense.
export function cleanWinners(codes, saved)
{
    const winners = new Array(MATCH_COUNT).fill("");

    for (let round = 0; round < ROUND_COUNT; round++)
    {
        for (let match = 0; match < matchesInRound(round); match++)
        {
            const index = ROUND_START[round] + match;
            const teams = participants(codes, winners, round, match);
            const pick = Array.isArray(saved) && typeof saved[index] === "string" ? saved[index] : "";

            if (teams[0] !== "" && teams[1] !== "" && (pick === teams[0] || pick === teams[1]))
            {
                winners[index] = pick;
            }
        }
    }

    return winners;
}

// { BOS: 1, TOR: 5, ... } where 1 to 4 is the round that team was knocked out in
// and 5 (CHAMPION) is the team that won the final. Teams still playing are left out.
export function eliminationRounds(codes, winners)
{
    const result = {};

    for (let round = 0; round < ROUND_COUNT; round++)
    {
        for (let match = 0; match < matchesInRound(round); match++)
        {
            const winner = winners[ROUND_START[round] + match];

            if (winner === "")
            {
                continue;
            }

            const teams = participants(codes, winners, round, match);
            const loser = teams[0] === winner ? teams[1] : teams[0];

            result[loser] = round + 1;

            if (round === ROUND_COUNT - 1)
            {
                result[winner] = CHAMPION;
            }
        }
    }

    return result;
}