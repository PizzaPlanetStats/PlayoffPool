// Pizza Planet - suffixes shown to the right of a team name.
// A team picks one of the suffixes it has earned (Account Settings on its page). What is saved on the public team is a short key:
//   "ach:ID"    an unlocked achievement (ID is the achievement id)
//   "champ:YEAR" won a league that year, shown as "2019 CHAMP"
//   "multi:N"   won N leagues (2 or more), shown as "2 TIME CHAMP"
// The text is always built from the key here, so nobody can type their own.

import { ACHIEVEMENTS } from "./achievements.js";

// the words for a key, or "" when the key isn't one we know
export function suffixLabel(key)
{
    const text = String(key || "");
    const parts = text.split(":");

    if (parts[0] === "ach")
    {
        const found = ACHIEVEMENTS.find(function(achievement) { return achievement.id === parts[1]; });
        return found ? found.name : "";
    }

    if (parts[0] === "champ" && /^[0-9]{4}$/.test(parts[1] || ""))
    {
        return parts[1] + " CHAMP";
    }

    if (parts[0] === "multi" && /^[0-9]{1,2}$/.test(parts[1] || "") && Number(parts[1]) >= 2)
    {
        return parts[1] + " TIME CHAMP";
    }

    return "";
}

// "ach" (achievements) or "gold" (wins)
export function suffixKind(key)
{
    return String(key || "").indexOf("ach:") === 0 ? "ach" : "gold";
}

// puts the suffix after whatever is already in parent (the team name). Does nothing when there is no valid suffix.
export function appendSuffix(parent, key)
{
    const label = suffixLabel(key);

    if (label === "")
    {
        return;
    }

    const span = document.createElement("span");
    span.className = "suffix suffix-" + suffixKind(key);
    span.textContent = "[" + label + "]";

    parent.appendChild(span);
}

// every suffix a team has earned: [{ key, label }]
//   unlocked = achievement ids on the team, seasons = [{ year, place }] of the leagues it finished
export function suffixOptions(unlocked, seasons)
{
    const options = [];

    const wins = seasons.filter(function(season) { return season.place === 1; });

    if (wins.length >= 2)
    {
        options.push("multi:" + Math.min(wins.length, 99));
    }

    const years = Array.from(new Set(wins.map(function(season) { return season.year; }))).sort(function(a, b) { return b - a; });

    years.forEach(function(year) {
        if (/^[0-9]{4}$/.test(String(year)))
        {
            options.push("champ:" + year);
        }
    });

    ACHIEVEMENTS.forEach(function(achievement) {
        if (unlocked.includes(achievement.id))
        {
            options.push("ach:" + achievement.id);
        }
    });

    return options.map(function(key) { return { key: key, label: suffixLabel(key) }; });
}