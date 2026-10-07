// Pizza Planet - the four phases a league goes through. Edit the wording here and every page picks it up.
//   key     = what gets saved on the league  (phase: "open")
//   label   = short name for tables
//   choice  = the wording on the create and edit league forms
//   message = what the league's own page says
// Leagues made before phases existed have signupsOpen true or false instead, see leaguePhase().

export const PHASES = [
  {
    key: "created",
    label: "Not open yet",
    choice: "League created, registration not open yet",
    message: "Registration is not open yet."
  },
  {
    key: "open",
    label: "Registration open",
    choice: "Registration open",
    message: "Registration is open."
  },
  {
    key: "ongoing",
    label: "Ongoing",
    choice: "Registration closed, league ongoing",
    message: "Registration is closed. The league is underway."
  },
  {
    key: "ended",
    label: "Ended",
    choice: "League ended",
    message: "This league has ended."
  }
];

export function phaseInfo(key)
{
    return PHASES.find(function(phase) {
        return phase.key === key;
    }) || PHASES[0];
}

// the phase of a saved league. Older leagues only have signupsOpen, so open is "open" and closed is "created".
export function leaguePhase(data)
{
    if (PHASES.some(function(phase) { return phase.key === data.phase; }))
    {
        return data.phase;
    }

    return data.signupsOpen === true ? "open" : "created";
}