/**
 * ticket.js - Populates ticket.html from the registration saved by validation.js.
 *
 * If no valid saved data exists (for example, the page was opened directly),
 * the visitor is redirected to index.html before anything is shown.
 */
"use strict";

/** localStorage key shared with validation.js. Keep both files in sync. */
const STORAGE_KEY = "codingConf.registration";

/** Same GitHub handle rule used during registration. */
const GITHUB_PATTERN = /^@(?=.{1,39}$)[a-z\d]+(?:-[a-z\d]+)*$/i;

const REQUIRED_KEYS = ["name", "email", "github", "avatar", "serial"];

/**
 * Reads and checks the saved registration.
 * @returns {{name: string, email: string, github: string, avatar: string, serial: string}|null}
 *          the registration, or null when missing or malformed
 */
function loadRegistration() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const hasAllKeys = data && REQUIRED_KEYS.every((key) => typeof data[key] === "string" && data[key] !== "");
    const isSafe = hasAllKeys && data.avatar.startsWith("data:image/") && GITHUB_PATTERN.test(data.github);
    return isSafe ? data : null;
  } catch {
    // Storage unavailable or JSON corrupted: treat as "no registration"
    return null;
  }
}

/**
 * Writes the registration values into the ticket and heading.
 * Uses textContent (never innerHTML) so user input cannot inject markup.
 * @param {object} registration
 */
function renderTicket(registration) {
  const avatar = document.getElementById("ticket-avatar");
  const githubLink = document.getElementById("ticket-github");

  document.getElementById("heading-name").textContent = registration.name;
  document.getElementById("ticket-email").textContent = registration.email;
  document.getElementById("ticket-name").textContent = registration.name;
  document.getElementById("ticket-github-text").textContent = registration.github;
  document.getElementById("ticket-serial").textContent = registration.serial;

  avatar.src = registration.avatar;
  avatar.alt = `Avatar of ${registration.name}`;
  githubLink.href = `https://github.com/${encodeURIComponent(registration.github.slice(1))}`;

  document.title = `Ticket for ${registration.name} | Coding Conf 2026`;
  document.getElementById("main").hidden = false;
}

/** Removes the saved registration and returns to the form. */
function startNewRegistration() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = "login.html";
}

/* ---------- Initialise ---------- */

const registration = loadRegistration();

if (registration) {
  renderTicket(registration);
  document.getElementById("new-registration").addEventListener("click", startNewRegistration);
} else {
  // Routing guard: no data means the visitor skipped the form
  window.location.replace("index.html");
}
