(() => {
  "use strict";

  const config = window.NAVIQUO_CONFIG || {};
  if (!config.SUPABASE_URL || config.SUPABASE_URL.includes("PASTE_")) {
    document.getElementById("loginError").hidden = false;
    document.getElementById("loginError").textContent = "Supabase has not been connected yet. Complete config.js first.";
    return;
  }

  const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  const charts = {};
  let allResponses = [];
  let filteredResponses = [];

  const $ = (id) => document.getElementById(id);
  const loginView = $("loginView");
  const appView = $("appView");

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    wireEvents();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await enterAdmin(session.user);
    } else {
      showLogin();
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) await enterAdmin(session.user);
      else showLogin();
    });
  }

  function wireEvents() {
    $("loginForm").addEventListener("submit", signIn);
    $("signOutButton").addEventListener("click", () => supabase.auth.signOut());
    $("refreshButton").addEventListener("click", loadResponses);
    $("exportButton").addEventListener("click", () => exportCsv(filteredResponses, "naviquo-research-responses.csv"));
    $("exportBetaButton").addEventListener("click", () => exportCsv(betaRows(), "naviquo-beta-testers.csv"));
    $("searchInput").addEventListener("input", applyFilters);
    $("cruiseFilter").addEventListener("change", applyFilters);
    $("departmentFilter").addEventListener("change", applyFilters);
    $("clearFilters").addEventListener("click", clearFilters);

    document.querySelectorAll("[data-view]").forEach(button => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
    document.querySelectorAll("[data-view-jump]").forEach(button => {
      button.addEventListener("click", () => switchView(button.dataset.viewJump));
    });
  }

  async function signIn(event) {
    event.preventDefault();
    const button = $("loginButton");
    button.disabled = true;
    button.textContent = "Signing in…";
    $("loginError").hidden = true;

    const { error } = await supabase.auth.signInWithPassword({
      email: $("loginEmail").value.trim(),
      password: $("loginPassword").value
    });

    if (error) {
      $("loginError").hidden = false;
      $("loginError").textContent = error.message;
    }

    button.disabled = false;
    button.textContent = "Sign in";
  }

  async function enterAdmin(user) {
    const { data: adminRecord, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !adminRecord) {
      await supabase.auth.signOut();
      showToast("This account is not approved as a Naviquo administrator.", true);
      return;
    }

    $("signedInAs").textContent = user.email || "";
    loginView.hidden = true;
    appView.hidden = false;
    await loadResponses();
  }

  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
    $("loginPassword").value = "";
  }

  async function loadResponses() {
    $("refreshButton").disabled = true;
    $("refreshButton").textContent = "Refreshing…";

    const { data, error } = await supabase
      .from("research_responses")
      .select("*")
      .order("created_at", { ascending: false });

    $("refreshButton").disabled = false;
    $("refreshButton").textContent = "Refresh";

    if (error) {
      showToast(error.message, true);
      return;
    }

    allResponses = data || [];
    filteredResponses = allResponses.slice();
    populateFilters();
    renderAll();
    $("lastUpdated").textContent = `Updated ${new Date().toLocaleString()}`;
    showToast("Dashboard refreshed.");
  }

  function switchView(view) {
    document.querySelectorAll(".view-panel").forEach(panel => panel.hidden = true);
    document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    $(`${view}View`).hidden = false;
    $("pageTitle").textContent = view === "beta" ? "Beta testers" : titleCase(view);
  }

  function renderAll() {
    updateKpis();
    drawCharts();
    renderLatestFeedback();
    renderResponseTable();
    renderBetaTable();
  }

  function updateKpis() {
    $("totalResponses").textContent = filteredResponses.length;
    $("cruiseLines").textContent = unique(filteredResponses.map(row => row.cruise_line)).length;
    $("departments").textContent = unique(filteredResponses.map(row => row.department)).length;
    $("betaTesters").textContent = filteredResponses.filter(row => row.beta_tester).length;
    $("marketingOptIns").textContent = filteredResponses.filter(row => row.marketing_consent).length;
    const betas = betaRows();
    $("betaCountLarge").textContent = betas.length;
    $("betaWithEmail").textContent = betas.filter(row => row.email).length;
  }

  function populateFilters() {
    setSelectOptions("cruiseFilter", unique(allResponses.map(row => row.cruise_line)));
    setSelectOptions("departmentFilter", unique(allResponses.map(row => row.department)));
  }

  function setSelectOptions(id, values) {
    const select = $(id);
    const label = select.options[0].textContent;
    select.innerHTML = `<option value="">${escapeHtml(label)}</option>` +
      values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function applyFilters() {
    const query = $("searchInput").value.trim().toLowerCase();
    const cruise = $("cruiseFilter").value;
    const department = $("departmentFilter").value;

    filteredResponses = allResponses.filter(row => {
      const haystack = Object.values(row).join(" ").toLowerCase();
      return (!query || haystack.includes(query)) &&
        (!cruise || row.cruise_line === cruise) &&
        (!department || row.department === department);
    });

    renderAll();
  }

  function clearFilters() {
    $("searchInput").value = "";
    $("cruiseFilter").value = "";
    $("departmentFilter").value = "";
    applyFilters();
  }

  function drawCharts() {
    drawChart("cruiseChart", "doughnut", countBy("cruise_line"), {
      cutout: "62%",
      plugins: { legend: { position: "right" } }
    });
    drawChart("departmentChart", "bar", countBy("department"), {
      indexAxis: "y",
      plugins: { legend: { display: false } }
    });
    drawChart("experienceChart", "bar", countBy("years_at_sea"), {
      plugins: { legend: { display: false } }
    });
    drawChart("featureChart", "bar", countFeatures().slice(0, 10), {
      indexAxis: "y",
      plugins: { legend: { display: false } }
    });
  }

  function drawChart(id, type, entries, extraOptions = {}) {
    if (charts[id]) charts[id].destroy();
    const labels = entries.length ? entries.map(([label]) => label) : ["No data"];
    const values = entries.length ? entries.map(([, value]) => value) : [0];

    charts[id] = new Chart($(id), {
      type,
      data: {
        labels,
        datasets: [{
          data: values,
          borderWidth: 0,
          backgroundColor: ["#12dbc2", "#1597ff", "#6b62ff", "#6fe7f7", "#3d77ff", "#8b9eff", "#14b8a6", "#4f8cff", "#78e8d8", "#a4b4ff"]
        }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        color: "#dce8f8",
        scales: type === "doughnut" ? undefined : {
          x: { ticks: { color: "#a9bddb", precision: 0 }, grid: { color: "rgba(83,127,181,.22)" }, beginAtZero: true },
          y: { ticks: { color: "#dce8f8" }, grid: { display: false } }
        },
        plugins: {
          legend: { labels: { color: "#dce8f8", boxWidth: 12 } },
          tooltip: { displayColors: false }
        },
        ...extraOptions
      }
    });
  }

  function countBy(field) {
    const counts = new Map();
    filteredResponses.forEach(row => {
      const value = String(row[field] || "").trim();
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function countFeatures() {
    const counts = new Map();
    filteredResponses.forEach(row => {
      const features = Array.isArray(row.features)
        ? row.features
        : String(row.features || "").split(/[,;\n]/);

      features.map(feature => String(feature).trim()).filter(Boolean).forEach(feature => {
        counts.set(feature, (counts.get(feature) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderLatestFeedback() {
    const rows = filteredResponses.slice(0, 6);
    $("latestFeedback").innerHTML = rows.length ? rows.map(row => `
      <article class="feedback-item">
        <div class="feedback-meta">
          <strong>${escapeHtml(row.cruise_line || "Unspecified")}</strong><br>
          ${escapeHtml(row.department || "Department not given")}<br>
          ${formatDate(row.created_at)}
        </div>
        <p class="feedback-copy">${escapeHtml(row.biggest_frustration || row.day_one_feature || row.other_ideas || "No written feedback supplied.")}</p>
      </article>
    `).join("") : `<p class="muted">No responses yet.</p>`;
  }

  function renderResponseTable() {
    $("responseCount").textContent = `${filteredResponses.length} of ${allResponses.length} responses shown`;
    $("responsesBody").innerHTML = filteredResponses.map(row => `
      <tr>
        <td>${formatDate(row.created_at)}</td>
        <td>${escapeHtml(row.first_name)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.cruise_line)}</td>
        <td>${escapeHtml(row.department)}</td>
        <td>${escapeHtml(row.position)}</td>
        <td>${escapeHtml(row.years_at_sea)}</td>
        <td>${escapeHtml(formatFeatures(row.features))}</td>
        <td>${escapeHtml(row.biggest_frustration)}</td>
        <td>${escapeHtml(row.day_one_feature)}</td>
        <td>${escapeHtml(row.weekly_feature)}</td>
        <td>${escapeHtml(row.other_ideas)}</td>
        <td>${yesPill(row.beta_tester)}</td>
        <td>${yesPill(row.marketing_consent)}</td>
      </tr>
    `).join("");
  }

  function renderBetaTable() {
    const rows = betaRows();
    $("betaBody").innerHTML = rows.map(row => `
      <tr>
        <td>${escapeHtml(row.first_name)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.cruise_line)}</td>
        <td>${escapeHtml(row.department)}</td>
        <td>${escapeHtml(row.position)}</td>
        <td>${escapeHtml(formatFeatures(row.features))}</td>
      </tr>
    `).join("");
  }

  function betaRows() {
    return filteredResponses.filter(row => row.beta_tester);
  }

  function exportCsv(rows, filename) {
    const columns = [
      ["created_at", "Timestamp"], ["first_name", "First name"], ["email", "Email"],
      ["cruise_line", "Cruise line"], ["department", "Department"], ["position", "Position"],
      ["years_at_sea", "Years at sea"], ["features", "Features"], ["biggest_frustration", "Biggest frustration"],
      ["day_one_feature", "Day-one feature"], ["weekly_feature", "Weekly feature"], ["other_ideas", "Other ideas"],
      ["beta_tester", "Beta tester"], ["marketing_consent", "Marketing consent"]
    ];

    const csvRows = [
      columns.map(([, label]) => label),
      ...rows.map(row => columns.map(([key]) => key === "features" ? formatFeatures(row[key]) : row[key]))
    ];

    const csv = csvRows.map(row => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function formatFeatures(value) {
    return Array.isArray(value) ? value.join(", ") : String(value || "");
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function yesPill(value) {
    return value ? `<span class="pill">Yes</span>` : "No";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString();
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function showToast(message, isError = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = `toast show${isError ? " error" : ""}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.className = "toast", 3000);
  }
})();
