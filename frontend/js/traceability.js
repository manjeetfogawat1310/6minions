const page = () => document.querySelector("#page-traceability");

function make(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== "") el.textContent = text;
  return el;
}

async function getBatches() {
  const response = await fetch("/api/batches");
  if (!response.ok) throw new Error("Could not load batches.");
  const data = await response.json();
  return Array.isArray(data) ? data : (data.batches || []);
}

async function loadTimeline(batchId) {
  const box = document.querySelector("#trace-events");
  box.replaceChildren(make("div", "empty", "Loading recorded events..."));

  try {
    const response = await fetch(
      `/api/traceability/${encodeURIComponent(batchId)}`
    );

    if (!response.ok) {
      throw new Error("Could not load traceability events.");
    }

    const data = await response.json();
    const events = data.events || [];

    if (!events.length) {
      box.replaceChildren(
        make("div", "empty", "No traceability events recorded for this batch.")
      );
      return;
    }

    const timeline = make("div", "timeline");

    events.forEach((event, index) => {
      const item = make("div", "timeline-item");

      const title = make(
        "h3",
        "",
        event.event_type || `Event ${index + 1}`
      );

      const details = make("div", "details");

      const rows = [
        ["From", event.from_party],
        ["To", event.to_party],
        ["Location", event.location],
        ["Timestamp", event.timestamp],
        ["Transaction Hash", event.blockchain_tx_hash]
      ];

      rows.forEach(([label, value]) => {
        const row = make("div");
        row.append(
          make("dt", "", label),
          make("dd", "", value || "Unavailable")
        );
        details.append(row);
      });

      item.append(title, details);
      timeline.append(item);
    });

    box.replaceChildren(timeline);
  } catch (error) {
    box.replaceChildren(make("div", "error-box", error.message));
  }
}

async function refreshBatches() {
  const select = document.querySelector("#trace-batch");

  select.replaceChildren(
    new Option("Select a batch", "")
  );

  try {
    const batches = await getBatches();

    batches.forEach(batch => {
      const id = batch.batch_id || batch.id;
      if (!id) return;

      const label =
        `${id} | ${batch.honey_type || "Honey"} | ` +
        `${batch.quantity_kg ?? batch.quantity ?? "-"} kg`;

      select.appendChild(new Option(label, id));
    });

    document.querySelector("#trace-status").textContent =
      `${batches.length} batch records loaded.`;
  } catch (error) {
    document.querySelector("#trace-status").textContent =
      error.message;
  }
}

async function submitEvent(event) {
  event.preventDefault();

  const form = event.target;
  const batchId = document.querySelector("#trace-batch").value;

  if (!batchId) {
    alert("Please select a batch first.");
    return;
  }

  const payload = {
    event_type: form.event_type.value,
    from_party: form.from_party.value,
    to_party: form.to_party.value,
    location: form.location.value,
    metadata: {
      description: form.description.value || "Demo traceability event"
    }
  };

  const result = document.querySelector("#trace-submit-result");
  result.textContent = "Submitting event...";

  try {
    const response = await fetch(
      `/api/traceability/${encodeURIComponent(batchId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Failed to submit traceability event."
      );
    }

    result.textContent = "Event recorded successfully.";
    form.reset();

    await loadTimeline(batchId);
  } catch (error) {
    result.textContent = error.message;
  }
}

export function initTraceability() {
  const root = page();
  if (!root) return;

  root.innerHTML = `
    <div class="card">
      <h2>Supply Chain</h2>

      <p class="help">
        Follow the actual recorded movement and custody of a honey batch.
      </p>

      <div class="chain">
        <span>Farmer</span>
        <i>&gt;</i>
        <span>Collection Center</span>
        <i>&gt;</i>
        <span>Processor</span>
        <i>&gt;</i>
        <span>Buyer</span>
        <i>&gt;</i>
        <span>Consumer</span>
      </div>

      <div class="toolbar">
        <label>
          Batch
          <select id="trace-batch">
            <option value="">Select a batch</option>
          </select>
        </label>

        <button id="trace-load" class="button" type="button">
          Load Timeline
        </button>

        <button id="trace-refresh" class="button ghost" type="button">
          Refresh Batches
        </button>
      </div>

      <p id="trace-status" class="help"></p>
    </div>

    <div class="grid two section-gap">

      <div class="card">
        <h2>Recorded Events</h2>

        <div id="trace-events">
          <div class="empty">
            Select a batch and load its timeline.
          </div>
        </div>
      </div>

      <div class="card">

        <div class="card-header">
          <h2>Add Demo Event</h2>
          <span class="badge demo">DEMO OPERATOR</span>
        </div>

        <p class="help">
          This creates an actual traceability record in the backend.
        </p>

        <form id="trace-form">

          <div class="form-grid">

            <label class="full">
              Event Type
              <input
                name="event_type"
                required
                placeholder="e.g. Collection"
              >
            </label>

            <label>
              From
              <input
                name="from_party"
                required
                placeholder="e.g. Farmer"
              >
            </label>

            <label>
              To
              <input
                name="to_party"
                required
                placeholder="e.g. Collection Center"
              >
            </label>

            <label class="full">
              Location
              <input
                name="location"
                required
                placeholder="e.g. Bantala, Kolkata"
              >
            </label>

            <label class="full">
              Description
              <input
                name="description"
                placeholder="Optional event description"
              >
            </label>

          </div>

          <button class="button secondary" type="submit">
            Submit Event
          </button>

        </form>

        <div id="trace-submit-result" class="section-gap"></div>

      </div>

    </div>
  `;

  document
    .querySelector("#trace-refresh")
    .addEventListener("click", refreshBatches);

  document
    .querySelector("#trace-load")
    .addEventListener("click", () => {
      const id = document.querySelector("#trace-batch").value;

      if (!id) {
        alert("Please select a batch first.");
        return;
      }

      loadTimeline(id);
    });

  document
    .querySelector("#trace-form")
    .addEventListener("submit", submitEvent);

  refreshBatches();
}