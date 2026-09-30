
import { $, node, onPage, state } from "./app.js";

export function initDashboard() {
  $("#page-demo").innerHTML = `
    <div class="hero">
      <p class="eyebrow">LIVE DEMO / SIH PRESENTATION</p>
      <h2>Every hive has a story.<br>Every batch needs evidence.</h2>
      <p>
        Move through ten connected demonstration steps. Sensor scenarios and
        commercial estimates are simulated; AI, records, and verification results
        come from the configured backend.
      </p>
      <a class="button secondary" href="#hive">
        Start Sensor Simulation
      </a>
    </div>

    <div class="toolbar">
      <span class="badge demo">DEMO / SIMULATED INPUTS</span>
      <span id="demo-context" class="muted"></span>
    </div>

    <div id="demo-steps" class="demo-grid"></div>

    <div class="card section-gap">
      <h2>Presentation Guardrails</h2>

      <div class="grid three">
        <div>
          <h3>Simulation is explicit</h3>
          <p class="muted">
            Scenario readings, price estimates, and distance estimates
            are visibly labeled.
          </p>
        </div>

        <div>
          <h3>Evidence comes first</h3>
          <p class="muted">
            A transaction hash, uploaded file, or QR image alone
            never earns a verified badge.
          </p>
        </div>

        <div>
          <h3>Service failures stay visible</h3>
          <p class="muted">
            Unavailable backend or blockchain results are shown
            without fabricated fallback data.
          </p>
        </div>
      </div>
    </div>
  `;

  const steps = [
    [
      "Sensor Simulation",
      "Choose a healthy or stressed hive scenario.",
      "hive"
    ],
    [
      "AI Health Prediction",
      "Review the backend's health score and explanation.",
      "hive"
    ],
    [
      "Harvest Honey",
      "Review yield information and enter actual harvest quantity.",
      "batches"
    ],
    [
      "Create Batch",
      "Create a batch linked to the selected farmer and hive.",
      "batches"
    ],
    [
      "Upload Lab Report",
      "Attach a report and inspect its returned SHA-256 hash.",
      "lab"
    ],
    [
      "Blockchain Record",
      "Inspect backend anchoring status; no client-side anchoring is assumed.",
      "lab"
    ],
    [
      "Generate QR",
      "Display the QR issued by the backend when available.",
      "verification"
    ],
    [
      "Consumer Verification",
      "Open public verification and inspect explicit evidence.",
      "verification"
    ],
    [
      "Buyer Marketplace",
      "Filter inventory and distinguish simulated estimates.",
      "marketplace"
    ],
    [
      "Admin Regional Dashboard",
      "Review production, health, and recent regional events.",
      "admin"
    ]
  ];

  steps.forEach(([title, description, page], index) => {
    const card = node("article", "demo-step");

    const link = node("a", "button ghost small", "Open Step");
    link.href = `#${page}`;

    card.append(
      node(
        "span",
        "step-number",
        String(index + 1).padStart(2, "0")
      ),
      node("h3", "", title),
      node("p", "", description),
      link
    );

    $("#demo-steps").append(card);
  });

  function context() {
    $("#demo-context").textContent = state.batchId
      ? `Selected batch: ${state.batchId}`
      : "No batch selected. Start with a hive or select an existing batch.";
  }

  onPage("demo", context);

  window.addEventListener("batch:selected", context);

  context();
}