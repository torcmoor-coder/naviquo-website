https://script.google.com/macros/s/AKfycbxhCqgxwy4tYcHws48zUO9AABZORUhbt2UAoTilWlgcJDyXVW0PioAecRX8LzL9VwOG/exec


const form = document.querySelector("#research-form");
const statusBox = document.querySelector("#form-status");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    data.features = [...form.querySelectorAll('input[name="features"]:checked')].map(x => x.value).join(", ");
    data.submittedFrom = window.location.href;

    if (!NAVIQUO_FORM_ENDPOINT.startsWith("https://script.google.com/")) {
      statusBox.textContent = "Form setup is not complete yet. Please email tormoor@naviquo.com.";
      statusBox.style.color = "#ffb8c2";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    statusBox.textContent = "Submitting your ideas…";

    try {
      await fetch(NAVIQUO_FORM_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data)
      });
      form.reset();
      statusBox.textContent = "Thank you — your feedback has been received. Welcome aboard.";
      statusBox.style.color = "#7fffdc";
      document.querySelector("#form-success")?.removeAttribute("hidden");
    } catch (error) {
      statusBox.textContent = "Something went wrong. Please try again or email tormoor@naviquo.com.";
      statusBox.style.color = "#ffb8c2";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit my ideas";
    }
  });
}
