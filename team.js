// Pizza Planet - team account helpers (sign up, sign in, profiles)
// Uses the app set up in firebase.js. Keep the version number the same as in that file.

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export { auth, onAuthStateChanged, signOut, sendPasswordResetEmail };

export function validTeamName(name)
{
  return name.length >= 2 && name.length <= 30;
}

// returns the profile data, or null if there is no profile. Throws if the rules deny the read.
export async function getProfile(uid)
{
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// the public copy of a team (just the name), readable by anyone including signed-out visitors
export async function getPublicTeam(uid)
{
  const snap = await getDoc(doc(db, "teams", uid));
  return snap.exists() ? snap.data() : null;
}

export async function signUpTeam(teamName, email, password, inviteCode)
{
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  try
  {
    // two documents, saved together or not at all:
    //   users/{id} is the private profile (the rules only allow it if the league code matches)
    //   teams/{id} is the public copy of the team name, so signed-out visitors can see the team list
    const batch = writeBatch(db);

    batch.set(doc(db, "users", cred.user.uid), {
      teamName: teamName,
      inviteCode: inviteCode,
      createdAt: serverTimestamp()
    });
    batch.set(doc(db, "teams", cred.user.uid), { teamName: teamName });

    await batch.commit();
  }
  catch (err)
  {
    // wrong code: remove the new login so the email is free to try again
    await deleteUser(cred.user);
    const failure = new Error("Wrong league code");
    failure.code = "app/bad-league-code";
    throw failure;
  }

  return cred.user;
}

export async function signInTeam(email, password)
{
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getProfile(cred.user.uid);

  if (!profile)
  {
    await signOut(auth);
    const failure = new Error("No team profile");
    failure.code = "app/no-profile";
    throw failure;
  }

  return cred.user;
}

export async function updateTeamName(uid, teamName)
{
  // keep the private profile and the public copy of the name in step
  const batch = writeBatch(db);

  batch.update(doc(db, "users", uid), { teamName: teamName });
  batch.set(doc(db, "teams", uid), { teamName: teamName });

  await batch.commit();
}

// Firebase wants a recent login before a password change, so confirm the current password first
export async function changePassword(currentPassword, newPassword)
{
  const user = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, currentPassword);

  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}