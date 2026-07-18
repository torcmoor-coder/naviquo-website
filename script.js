/*
  NAVIQUO GOOGLE SHEETS SETUP
  Replace the placeholder below with the Web App URL produced by Google Apps Script.
  It should end in /exec.
*/
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhCqgxwy4tYcHws48zUO9AABZORUhbt2UAoTilWlgcJDyXVW0PioAecRX8LzL9VwOG/exec";

const menuButton = document.querySelector(".menu-toggle");
if (menuButton) {
  menuButton.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("menu-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

const form = document.getElementById("researchForm");
const statusBox = document.getElementById("formStatus");

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `form-status ${type}`;
  statusBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const honeypot = form.querySelector('[name="website"]');
    if (honeypot && honeypot.value) return;

    if (!GOOGLE_SCRIPT_URL.startsWith("https://script.google.com/")) {
      showStatus("The research form has not been connected to Google Sheets yet. Add your Apps Script Web App URL in script.js.", "error");
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    const formData = new FormData(form);
    const selectedFeatures = [...form.querySelectorAll('input[name="features"]:checked')]
      .map((input) => input.value)
      .join(", ");

    formData.delete("features");
    formData.append("features", selectedFeatures);
    formData.append("source", "naviquo.com research form");
    formData.append("submittedAtBrowser", new Date().toISOString());

    try {
      /* no-cors is required for the simple Google Apps Script endpoint.
         A successful network submission returns an opaque response. */
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData
      });

      form.reset();
      showStatus("Thank you — your feedback has been sent. You are helping shape what Naviquo becomes.", "success");
    } catch (error) {
      console.error(error);
      showStatus("Your response could not be sent. Please check your connection and try again.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send my feedback";
    }
  });
}
