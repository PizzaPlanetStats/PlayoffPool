// Pizza Planet - random splash text in the home page banner (like Minecraft's).
// Add, remove or reword lines in this list. Keep them short: a long one gets cramped on a phone.

var SPLASHES = [
    "Home is where the kelp is",
    "Have a Wonderful Wednesday!",
    "The best spring rolls on Earth are found at a filipino store ran out of a garage in St Thomas of the US Virgin Islands.",
    "Celebration Key crew area food truck has good burgers but subpar fries.",
    "No matter how much you test something, customers will always find a way to break it.",
    "If your car doesn't have a heated steering wheel, just sit on your hands and knee drive.",
    "Buy a USB stick based on how cool the mechanism that opens it is, not anything else.",
    "Put pucks on net",
    "SNOWDAY!",
    "Gene trades when?",
    "Better than Colin trades",
    "**Important Organizational Update**",
    "Indorsed by Jason Spezza",
    "Get pucks in deep",
    "Live, Laugh, Love, Boo Gary Bettman",
    "Accept my Fleaflicker trades",
    "Home of the Jarry Haters",
    "Are SHU good this year?",
    "It's called the Barrie Molson Center",
    "When it's 11:37",
    "#LLBM",
    "BIG text to world connection watching Breaking Bad while living next to a crack den",
    "2",
    "It's over",
    "You scored an average of 3037 over 10 rounds in today's EthnoGuessr! You had 3 perfect rounds!",
    "Featuring the captain, J.T. Miller",
    "The Branslammers are proud to announce that we have placed a hit on Epstein Islanders player Connor McDavid.",
    "The Mighty Beavers have publically denounced the Epstein Islanders, warning the world that they are not to be trusted.",
    "Դու ինձ կանչում ես իմ անցքից, որտեղ ես սողացել եմ, որ մեռնեմ: Դու ինձ փչացնում ես այդ մեղմ գրկախառնությամբ։ Այդ սառը ներումը։ Եվ դու ինձ դրեցիր այստեղ: Ինչի համար? Տառապել։ Ձեր ոտքերի մոտ: ես քեզ հայհոյում եմ։ ես քեզհայհոյում եմ",
    "Don Cherry did nothing wrong",
    "first",
    "crash the net and good things happen",
    "What is goalie interference?",
    "COFFEE HIERARCHY: CIRCLE K > MCDONALDS > STARBUCKS > TIM HORTONS > 7-ELEVEN",
    "Bogosort is the most efficent sorting algorithm in the world with a best case of Ω(n)",
    "Fueled by Costco Glizzys",
    "Every injury is career ending until they get better.",
    "Christmas week means sportsnet/TSN plays and misplays of the years",
    "No U-turns",
    "Heather will only accept rye bread toasted and lightly buttered during breakfast.",
    "After you ask your smart speaker “What does brb mean?” ask it to play 1075 CoolFM",
    "Do not go into the Vaughan Metropolitan Centre bathrooms",
    "NOTICE! If you're drinking to forget... PLEASE PAY IN ADVANCE",
    "if you're not first you're last",
    "Treat everyday like it's Ian Cottage Day",
    "Kiwi's Kiwis bottom-four win",
    "Powered by JackWire",
    "Do the Geogrid",
    "Calculated.",
    "Home of your morning broadcast",
    "1967",
    "A new trade is up for review. If you feel the trade is unfair, you may veto it.",
    "What did Corey Perry do on November 27, 2023?",
    "This year is our year"
];

(function() {
    var banner = document.getElementById("banner");
    var logo = banner ? banner.querySelector("h1") : null;
 
    if (!logo)
    {
        return;
    }
 
    var splash = document.createElement("div");
    splash.id = "splash";
    var text = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    splash.textContent = text;
 
    // the text always sits in the corner of the logo: short lines get big text, and the longer the line the smaller the text
    var n = text.length;
    var size = n <= 14 ? 24 : n <= 22 ? 20 : n <= 30 ? 17 : n <= 40 ? 14 : n <= 60 ? 11 : n <= 90 ? 9 : 7;
    splash.style.setProperty("--splash-size", size + "px");
 
    logo.classList.add("has-splash");
    logo.appendChild(splash);
})();