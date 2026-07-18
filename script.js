const config = window.NAVIQUO_CONFIG;

if (
  !config ||
  !config.SUPABASE_URL ||
  !config.SUPABASE_ANON_KEY ||
  !window.supabase
) {
  console.error("Supabase configuration is missing.");
}

const supabaseClient = window.supabase.createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);

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

document
  .querySelectorAll(".reveal")
  .forEach((element) => revealObserver.observe(element));

const form = document.getElementById("researchForm");
const statusBox = document.getElementById("formStatus");

function showStatus(message, type) {
  if (!statusBox) return;

  statusBox.textContent = message;
  statusBox.className = `form-status ${type}`;
  statusBox.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function camelToSnake(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const honeypot = form.querySelector('[name="website"]');

    if (honeypot && honeypot.value) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    try {
      const formData = new FormData(form);
      const responseData = {};

      for (const [name, value] of formData.entries()) {
        if (
          name === "website" ||
          name === "features" ||
          name === "researchConsent" ||
          name === "betaTester" ||
          name === "marketingConsent"
        ) {
          continue;
        }

        const columnName =
  name === "otherSuggestions"
    ? "other_ideas"
    : camelToSnake(name);

responseData[columnName] =
  typeof value === "string" ? value.trim() : value;
      }

     responseData.features = [
  ...form.querySelectorAll('input[name="features"]:checked')
]
  .map((input) => input.value)
  .join(", ");

      responseData.research_consent = Boolean(
        form.querySelector('[name="researchConsent"]')?.checked
      );

      responseData.beta_tester = Boolean(
        form.querySelector('[name="betaTester"]')?.checked
      );

      responseData.marketing_consent = Boolean(
        form.querySelector('[name="marketingConsent"]')?.checked
      );

      responseData.submitted_from = "naviquo.com research form";

      const { error } = await supabaseClient
        .from("research_responses")
        .insert([responseData]);

      if (error) {
        throw error;
      }

      form.reset();

      showStatus(
        "Thank you — your feedback has been sent. You are helping shape what Naviquo becomes.",
        "success"
      );
    } catch (error) {
      console.error("Survey submission failed:", error);

      showStatus(
        "Your response could not be sent. Please check your connection and try again.",
        "error"
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send my feedback";
    }
  });
}
