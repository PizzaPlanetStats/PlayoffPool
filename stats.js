// Pizza Planet - the stats a league can track.
//   key   = the field name in the NHL stats API data (double-check these when we build the stats fetch)
//   label = what people see on the site
// To add or rename a stat, edit it here and every page picks it up.

export const SKATER_STATS = [
  { key: "gamesPlayed",      label: "Games played" },
  { key: "goals",            label: "Goals" },
  { key: "assists",          label: "Assists" },
  { key: "points",           label: "Points" },
  { key: "plusMinus",        label: "Plus/minus" },
  { key: "penaltyMinutes",   label: "Penalty minutes" },
  { key: "ppGoals",          label: "Powerplay goals" },
  { key: "ppPoints",         label: "Powerplay points" },
  { key: "shGoals",          label: "Shorthanded goals" },
  { key: "shPoints",         label: "Shorthanded points" },
  { key: "gameWinningGoals", label: "Game winning goals" },
  { key: "otGoals",          label: "Overtime goals" },
  { key: "shots",            label: "Shots" }
];

export const GOALIE_STATS = [
  { key: "gamesPlayed",  label: "Games played" },
  { key: "wins",         label: "Wins" },
  { key: "losses",       label: "Losses" },
  { key: "otLosses",     label: "Overtime losses" },
  { key: "shutouts",     label: "Shutouts" },
  { key: "saves",        label: "Saves" },
  { key: "shotsAgainst", label: "Shots against" },
  { key: "goalsAgainst", label: "Goals against" }
];