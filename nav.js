// Pizza Planet - nav bar changes that depend on who is signed in
//   "Sign In" becomes "My Team" for a signed-in team
//   an "Admin Home" button is added for the admin (not on the admin page itself)

import { isAdmin } from "./firebase.js";
import { auth, onAuthStateChanged, getProfile } from "./team.js";

const nav = document.getElementById("nav");
const link = document.getElementById("auth-link");
const onAdminPage = location.pathname.toLowerCase().includes("adminhome");

function removeAdminLink()
{
  const existing = document.getElementById("admin-link");

  if (existing)
  {
    existing.remove();
  }
}

function addAdminLink()
{
  if (!nav || onAdminPage || document.getElementById("admin-link"))
  {
    return;
  }

  const adminLink = document.createElement("a");
  adminLink.id = "admin-link";
  adminLink.className = "admin-link";
  adminLink.href = "adminHome.html";
  adminLink.textContent = "Admin Home";
  nav.appendChild(adminLink);
}

if (link)
{
  onAuthStateChanged(auth, async function(user) {
    if (!user)
    {
      link.classList.remove("hidden");
      link.textContent = "Sign In";
      link.href = "signin.html";
      removeAdminLink();
      return;
    }

    link.textContent = "My Team";
    link.href = "user.html?id=" + encodeURIComponent(user.uid);

    if (await isAdmin(user))
    {
      addAdminLink();

      // the admin may not have a team of their own, so hide "My Team" if there isn't one
      try
      {
        const hasTeam = await getProfile(user.uid);
        link.classList.toggle("hidden", !hasTeam);
      }
      catch (err)
      {
        link.classList.add("hidden");
      }
    }
    else
    {
      removeAdminLink();
    }
  });
}