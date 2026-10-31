/**
 * validation.js - Registration form logic for login.html.
 *
 * Responsibilities:
 *  1. Intercept the form submit event (no native constraint validation).
 *  2. Validate avatar, full name, email and GitHub handle with in-place error messages.
 *  3. Show a live preview of a valid avatar.
 *  4. Save the verified registration to localStorage and forward the user to ticket.html.
 */
"use strict";

/* ---------- Configuration ---------- */

/** localStorage key shared with ticket.js. Keep both files in sync. */
const STORAGE_KEY = "codingConf.registration";

/** Largest avatar accepted, in bytes (500KB). */
const MAX_AVATAR_BYTES = 500 * 1024;

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png"];
const AVATAR_EXTENSION_PATTERN = /\.(jpe?g|png)$/i;

/** user@domain.com style structure with a 2+ character top-level domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "@" followed by 1-39 letters, digits or single hyphens (GitHub username rules). */
const GITHUB_PATTERN = /^@(?=.{1,39}$)[a-z\d]+(?:-[a-z\d]+)*$/i;

const DEFAULT_PROMPT = "Drag and drop or click to upload";
const CHANGE_PROMPT = "Click to change image";

/* ---------- DOM references ---------- */

const form = document.getElementById("registration-form");
const avatarInput = document.getElementById("avatar");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const githubInput = document.getElementById("github");
const avatarIcon = document.getElementById("avatar-icon");
const avatarPreview = document.getElementById("avatar-preview");
const avatarPrompt = document.getElementById("avatar-prompt");
const avatarRemoveButton = document.getElementById("avatar-remove");
const statusMessage = document.getElementById("form-status");

/** Object URL for the current preview image, revoked when replaced. */
let previewUrl = null;

/* ---------- Validators (return an error message, or "" when valid) ---------- */

/**
 * Full name must contain at least one non-space character.
 * @param {string} value
 * @returns {string}
 */
function validateName(value) {
  return value.trim() === "" ? "Please enter your full name." : "";
}

/**
 * Email must match user@domain.com.
 * @param {string} value
 * @returns {string}
 */
function validateEmail(value) {
  return EMAIL_PATTERN.test(value.trim())
    ? ""
    : "Please enter a valid email address (for example, user@domain.com).";
}

/**
 * GitHub handle must start with "@" followed by a valid username.
 * @param {string} value
 * @returns {string}
 */
function validateGithub(value) {
  return GITHUB_PATTERN.test(value.trim())
    ? ""
    : "Please enter a valid GitHub username starting with @ (for example, @jaydev).";
}

/**
 * Confirms the first bytes of the file match a real JPEG or PNG signature,
 * so a renamed file cannot slip past the MIME type check.
 * @param {File} file
 * @returns {Promise<boolean>}
 */
async function hasImageSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => bytes[i] === byte);
  return isJpeg || isPng;
}

/**
 * Avatar must exist, be a JPEG/PNG image and be under 500KB.
 * @param {File|undefined} file
 * @returns {Promise<string>}
 */
async function validateAvatar(file) {
  if (!file) {
    return "Please upload your avatar.";
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type) || !AVATAR_EXTENSION_PATTERN.test(file.name)) {
    return "Unsupported file type. Please upload a JPG or PNG image.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "File too large. Please upload a photo under 500KB.";
  }
  if (!(await hasImageSignature(file))) {
    return "This file is not a valid image. Please choose another photo.";
  }
  return "";
}

/* ---------- Field configuration (in on-screen order) ---------- */

const fields = [
  { control: avatarInput, validate: () => validateAvatar(avatarInput.files[0]) },
  { control: nameInput, validate: () => validateName(nameInput.value) },
  { control: emailInput, validate: () => validateEmail(emailInput.value) },
  { control: githubInput, validate: () => validateGithub(githubInput.value) }
];

/* ---------- Rendering helpers ---------- */

/**
 * Shows or clears the in-place error beneath a control and updates aria-invalid.
 * @param {HTMLElement} control - the input being described
 * @param {string} message - error text, or "" to clear
 */
function renderFieldMessage(control, message) {
  const errorBox = document.getElementById(`${control.id}-error`);
  const hint = document.getElementById(`${control.id}-hint`);

  errorBox.querySelector("span").textContent = message;
  errorBox.hidden = message === "";

  // The helper hint (avatar only) is replaced by the error while one is showing
  if (hint) {
    hint.hidden = message !== "";
  }

  if (message) {
    control.setAttribute("aria-invalid", "true");
  } else {
    control.removeAttribute("aria-invalid");
  }
}

/**
 * Displays the chosen image inside the drop zone.
 * @param {File} file
 */
function showPreview(file) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
  previewUrl = URL.createObjectURL(file);
  avatarPreview.src = previewUrl;
  avatarPreview.hidden = false;
  avatarIcon.hidden = true;
  avatarRemoveButton.hidden = false;
  avatarPrompt.textContent = CHANGE_PROMPT;
}

/** Restores the drop zone to its empty state. */
function clearPreview() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  avatarPreview.hidden = true;
  avatarIcon.hidden = false;
  avatarRemoveButton.hidden = true;
  avatarPrompt.textContent = DEFAULT_PROMPT;
}

/* ---------- Persistence helpers ---------- */

/**
 * Reads a file into a base64 data URL so it survives the page change.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

/**
 * Builds a five-digit ticket number such as "#01609".
 * @returns {string}
 */
function generateSerial() {
  const number = Math.floor(Math.random() * 99999) + 1;
  return `#${String(number).padStart(5, "0")}`;
}

/* ---------- Event handlers ---------- */

/**
 * Validates every field, then saves the registration and redirects.
 * @param {SubmitEvent} event
 */
async function handleSubmit(event) {
  event.preventDefault();
  statusMessage.textContent = "";

  let firstInvalid = null;
  for (const field of fields) {
    const message = await field.validate();
    renderFieldMessage(field.control, message);
    if (message && !firstInvalid) {
      firstInvalid = field.control;
    }
  }

  if (firstInvalid) {
    statusMessage.textContent = "Please fix the highlighted fields and try again.";
    firstInvalid.focus();
    return;
  }

  try {
    const avatar = await readFileAsDataUrl(avatarInput.files[0]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: nameInput.value.trim().replace(/\s+/g, " "),
      email: emailInput.value.trim(),
      github: githubInput.value.trim(),
      avatar,
      serial: generateSerial()
    }));
    window.location.href = "ticket.html";
  } catch {
    statusMessage.textContent = "We could not save your ticket. Try a smaller image or check your browser storage settings.";
  }
}

/** Validates the avatar as soon as a file is chosen and previews it if valid. */
async function handleAvatarChange() {
  const file = avatarInput.files[0];
  const message = await validateAvatar(file);

  // Ignore results from an older selection if the user picked again meanwhile
  if (file !== avatarInput.files[0]) {
    return;
  }

  renderFieldMessage(avatarInput, message);
  if (file && message === "") {
    showPreview(file);
  } else {
    clearPreview();
  }
}

/** Clears the chosen avatar and any related error. */
function handleAvatarRemove() {
  avatarInput.value = "";
  clearPreview();
  renderFieldMessage(avatarInput, "");
  avatarInput.focus();
}

/* ---------- Event wiring ---------- */

form.addEventListener("submit", handleSubmit);
avatarInput.addEventListener("change", handleAvatarChange);
avatarRemoveButton.addEventListener("click", handleAvatarRemove);

// Text fields: validate on blur, then keep re-checking while an error is showing
for (const field of fields.slice(1)) {
  field.control.addEventListener("blur", async () => {
    renderFieldMessage(field.control, await field.validate());
  });
  field.control.addEventListener("input", async () => {
    if (field.control.hasAttribute("aria-invalid")) {
      renderFieldMessage(field.control, await field.validate());
    }
  });
}
