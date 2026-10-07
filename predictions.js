// Pizza Planet - the team predictions that earn points, and the default points for each.
// key    = what gets saved on a league  (predictionPoints: { round1: 10, ... champion: 50 })
// label  = what people see
// points = the starting value on the create league form
// A team is "knocked out in round 4" when it loses the final, and "champion" when it wins it.

export const PREDICTION_POINTS = [
  { key: "round1",   label: "Round 1 elimination",                 points: 10 },
  { key: "round2",   label: "Round 2 elimination",                 points: 20 },
  { key: "round3",   label: "Round 3 elimination",                 points: 30 },
  { key: "round4",   label: "Round 4 elimination",                 points: 40 },
  { key: "champion", label: "Stanley Cup Champion",                            points: 50 }
];

export const ONE_ROUND_OFF_RULE = "A prediction that is 1 round off earns half the points of the lower round.";