import { api, list, unwrap, segment } from "./api.js";
import {
  $, node, pick, number, date, details, raw, status, options, table, task,
  toast, formData, onPage, state, selectBatch, qrPanel, modal, recordButton,
  verificationBadge, blockchainValue
} from "./app.js";

let batchRows = [];
let hiveRows = [];

export function batchDetails(data) {
  return details([
    ["Batch ID", pick(data, "batch_id", "id")],
    ["Farmer", pick(data, "farmer_id", "farmer.name")],
    ["Hive", data?.hive_id],
    ["Honey type", data?.honey_type],
    ["Quantity", number(data?.quantity, "kg")],
    ["Available quantity", number(data?.available_quantity, "kg")],
    ["Harvest date", date(data?.harvest_date)],
    ["Location", data?.location],
    ["Region", data?.region],
    ["Lab status", status(pick(data, "lab_status", "lab_report.status"))],
    ["Blockchain verification", verificationBadge(blockchainValue(data))],
    ["Blockchain record status", pick(data, "blockchain_status", "blockchain.status")],
    ["Transaction hash", pick(data, "transaction_hash", "tx_hash", "blockchain.transaction_hash")]
  ]);
}

export async function loadBatchOptions() {
  batchRows = list(await api.get("/api/batches"), "batches");

  document.querySelectorAll("select[data-batch-select]").forEach(select => {
    options(
      select,
      batchRows,
      row => pick(row, "batch_id", "id"),
      row => `${pick(row, "batch_id", "id")} | ${row.honey_type || "Honey"}`
    );

    if (state.batchId) {
      select.value = state.batchId;
    }
  });

  return batchRows;
}

export function initBatches() {
  $("#page-batches").innerHTML = `
    <div class="grid two">
      <div class="card">
        <h2>Create Honey Batch</h2>

        <p class="help">
          Demo operator workflow. This creates a real backend record;
          enter the intended quantity rather than treating predicted yield
          as harvested honey.
        </p>

        <div id="batch-hive-status"></div>

        <form id="create-batch-form">
          <div class="form-grid">
            <label>
              Farmer
              <select id="batch-farmer" name="farmer_id" required>
                <option value="">Select a farmer</option>
              </select>
            </label>

            <label>
              Hive
              <select id="batch-hive" name="hive_id" required>
                <option value="">Select a hive</option>
              </select>
            </label>

            <label>
              Honey type
              <input name="honey_type" required placeholder="e.g. Multifloral">
            </label>

            <label>
              Quantity (kg)
              <input name="quantity" type="number" min="0.001" step="any" required>
            </label>

            <label>
              Harvest date
              <input name="harvest_date" type="date" required>
            </label>

            <label>
              Location
              <input name="location" required>
            </label>

            <label class="full">
              Region
              <select name="region" required>
              <option> Andhra Pradesh</option>
              <option>Arunachal Pradesh</option>
              <option>Assam</option>
              <option>Bihar</option>
              <option>Chhattisgarh</option>
              <option>Goa</option>
              <option>Gujarat</option>
              <option>Haryana</option>
              <option>Himachal Pradesh</option>
              <option>Jharkhand</option>
              <option>Karnataka</option>
              <option>Kerala</option>
              <option>Madhya Pradesh</option>
              <option>Maharashtra</option>
              <option>Manipur</option>
              <option>Meghalaya</option>
              <option>Mizoram</option>
              <option>Nagaland</option>
              <option>Odisha</option>
              <option>Punjab</option>
              <option>Rajasthan</option>
              <option>Sikkim</option>
              <option>Tamil Nadu</option>
              <option>Telangana</option>
              <option>Tripura</option>
              <option>Uttar Pradesh</option>
              <option>Uttarakhand</option>
              <option>West Bengal</option>
              <option>Andaman and Nicobar Islands</option>
              <option>Chandigarh</option>
              <option>Dadra and Nagar Haveli and </option>
              <option>Delhi</option>
              <option>Jammu and Kashmir</option>
              <option>Ladakh</option>
              <option>Lakshadweep</option>
              <option>Puducherry</option>
              </select>
            </label>
          </div>

          <div class="actions">
            <button class="button secondary" type="submit">
              Create Batch
            </button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2>Created Batch</h2>

        <div id="created-batch">
          <div class="empty">
            Your backend-issued batch and QR will appear here.
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Batch Inventory</h2>

        <button id="refresh-batches" class="button ghost" type="button">
          Refresh
        </button>
      </div>

      <div id="batch-list"></div>
    </div>

    <div class="card">
      <h2>Record Harvest Against an Existing Batch</h2>

      <p class="help">
        Use only when required by your backend workflow. Do not submit the
        same harvest twice. Batch creation and harvest recording are separate
        operations.
      </p>

      <form id="harvest-form">
        <div class="form-grid">
          <label>
            Batch
            <select name="batch_id" data-batch-select required>
              <option value="">Select a batch</option>
            </select>
          </label>

          <label>
            Harvest quantity (kg)
            <input name="quantity" type="number" min="0.001" step="any" required>
          </label>

          <label>
            Harvest date
            <input name="harvest_date" type="date" required>
          </label>

          <label>
            Location
            <input name="location" required>
          </label>
        </div>

        <div class="actions">
          <button class="button" type="submit">
            Record Harvest
          </button>
        </div>
      </form>

      <div id="harvest-result" class="section-gap"></div>
    </div>

    <!-- Hive-wise AI Yield Prediction -->
    <div class="card">
      <div class="card-header">
        <h2>Hive-wise Predicted Honey Yield</h2>

        <button
          id="refresh-hive-yields"
          class="button ghost"
          type="button"
        >
          Refresh
        </button>
      </div>

      <p class="help">
        Latest AI honey-yield predictions returned by the backend for each
        hive. Hives without an AI prediction are shown as unavailable.
      </p>

      <div id="hive-yield-list"></div>
    </div>
  `;

  function populateHives() {
    const farmerId = $("#batch-farmer").value;

    const filtered = hiveRows.filter(
      row => String(pick(row, "farmer_id", "farmer.id")) === farmerId
    );

    options(
      $("#batch-hive"),
      filtered,
      row => pick(row, "hive_id", "id"),
      row =>
        `${pick(row, "hive_id", "id")} | ${
          row.name || row.location || "Hive"
        }`
    );

    if (state.hiveId) {
      $("#batch-hive").value = state.hiveId;
    }
  }

  async function loadFarmers() {
    await task($("#batch-hive-status"), async () => {
      hiveRows = list(await api.get("/api/hives"), "hives");

      const farmers = new Map();

      hiveRows.forEach(row => {
        const id = pick(row, "farmer_id", "farmer.id");

        if (id !== null) {
          farmers.set(String(id), {
            id,
            name: pick(row, "farmer_name", "farmer.name") || id
          });
        }
      });

      options(
        $("#batch-farmer"),
        [...farmers.values()],
        row => row.id,
        row => `${row.name} (${row.id})`
      );

      const selected = hiveRows.find(
        row => String(pick(row, "hive_id", "id")) === state.hiveId
      );

      if (selected) {
        $("#batch-farmer").value = String(
          pick(selected, "farmer_id", "farmer.id") ?? ""
        );
      }

      populateHives();

      $("#batch-hive-status").replaceChildren(
        node(
          "p",
          "help",
          farmers.size
            ? "Farmers are derived from backend hive records."
            : "No farmer-linked hives were returned. Register a hive with a valid farmer ID first."
        )
      );
    });
  }

  async function loadHiveYieldPredictions() {
  await task($("#hive-yield-list"), async () => {
    const response = await api.get("/api/hives");
    const hives = list(response, "hives");

    const rows = hives.map(hive => {
      const ai = hive.latest_ai;

      const predictedYield =
        ai?.predicted_yield_kg !== null &&
        ai?.predicted_yield_kg !== undefined &&
        Number.isFinite(Number(ai.predicted_yield_kg))
          ? `${Number(ai.predicted_yield_kg).toFixed(2)} kg`
          : "Unavailable";

      return {
        hive: hive.hive_code || hive.name || hive.hive_id || "Unknown",
        farmer: hive.farmer_name || "—",
        location: hive.location || "—",
        health: ai?.health_status || "No AI record",
        diseaseRisk: ai?.disease_risk || "—",
        environmentalStress: ai?.environmental_stress || "—",
        yield: predictedYield,
        updated: ai?.created_at ? date(ai.created_at) : "—"
      };
    });

    if (!rows.length) {
      $("#hive-yield-list").replaceChildren(
        node(
          "div",
          "empty",
          "No hive records were returned by the backend."
        )
      );
      return;
    }

    $("#hive-yield-list").replaceChildren(
      table(
        [
          ["Hive", row => row.hive],
          ["Farmer", row => row.farmer],
          ["Location", row => row.location],
          ["Health", row => status(row.health)],
          ["Disease Risk", row => status(row.diseaseRisk)],
          ["Environmental Stress", row => row.environmentalStress],
          ["Predicted Yield", row => row.yield],  
          ["Last Updated", row => row.updated]
        ],
        rows
      )
    );
  });
}
  async function showBatch(id, button) {
    button.disabled = true;

    const content = node("div");

    modal(`Batch ${id}`, content);

    await task(content, async () => {
      const response = await api.get(
        `/api/batches/${segment(id)}`
      );

      const data =
        unwrap(response)?.batch ??
        unwrap(response);

      content.replaceChildren(
        batchDetails(data),
        qrPanel(data, id),
        raw(response)
      );
    });

    button.disabled = false;
  }

  async function refresh() {
    await task($("#batch-list"), async () => {
      const rows = await loadBatchOptions();

      $("#batch-list").replaceChildren(
        table(
          [
            ["Batch ID", row => pick(row, "batch_id", "id")],

            ["Honey type", row => row.honey_type],

            ["Quantity", row => number(row.quantity, "kg")],

            ["Harvest", row => date(row.harvest_date)],

            ["Location", row => row.location],

            [
              "Blockchain",
              row => verificationBadge(
                blockchainValue(row)
              )
            ],

            [
              "Actions",
              row => {
                const id = pick(
                  row,
                  "batch_id",
                  "id"
                );

                if (id === null) {
                  return "Batch ID unavailable";
                }

                const group = node(
                  "div",
                  "toolbar"
                );

                group.append(
                  recordButton(
                    "Details",
                    button => showBatch(id, button)
                  ),

                  recordButton(
                    "Select",
                    () => {
                      selectBatch(id);

                      toast(
                        `Batch ${id} selected for lab reports, traceability, and verification.`
                      );
                    }
                  )
                );

                return group;
              }
            ]
          ],
          rows
        )
      );
    });
  }

  // Farmer and hive selection
  $("#batch-farmer").addEventListener(
    "change",
    populateHives
  );

  $("#batch-hive").addEventListener(
    "change",
    event => {
      state.hiveId = event.target.value;
    }
  );

  // Refresh batches
  $("#refresh-batches").addEventListener(
    "click",
    refresh
  );

  // Refresh hive AI predictions
  $("#refresh-hive-yields").addEventListener(
    "click",
    loadHiveYieldPredictions
  );

  // Create batch
  $("#create-batch-form").addEventListener(
    "submit",
    event => {
      event.preventDefault();

      const payload = formData(event.target);

      payload.quantity = Number(
        payload.quantity
      );

      task(
        $("#created-batch"),
        async () => {
          const response = await api.post(
            "/api/batches",
            payload
          );

          const data =
            unwrap(response)?.batch ??
            unwrap(response);

          const id = pick(
            data,
            "batch_id",
            "id"
          );

          $("#created-batch").replaceChildren(
            batchDetails(data),
            qrPanel(data, id),
            raw(response)
          );

          if (id !== null) {
            selectBatch(id);

            toast(
              `Backend returned batch ${id}. Blockchain verification is shown separately.`
            );
          } else {
            toast(
              "Request accepted, but no batch ID was returned. Inspect the response before retrying.",
              "error"
            );
          }

          await refresh();
        },
        event.submitter
      );
    }
  );

  // Record harvest
  $("#harvest-form").addEventListener(
    "submit",
    event => {
      event.preventDefault();

      const payload = formData(
        event.target
      );

      const id = payload.batch_id;

      delete payload.batch_id;

      payload.quantity = Number(
        payload.quantity
      );

      task(
        $("#harvest-result"),
        async () => {
          const response = await api.post(
            `/api/batches/${segment(id)}/harvest`,
            payload
          );

          $("#harvest-result").replaceChildren(
            raw(response)
          );

          toast(
            "The backend accepted the harvest request. Inspect the returned record."
          );

          await refresh();
        },
        event.submitter
      );
    }
  );

  // Keep batch dropdowns synchronized
  window.addEventListener(
    "batch:selected",
    event => {
      document
        .querySelectorAll(
          "select[data-batch-select]"
        )
        .forEach(select => {
          select.value = event.detail;
        });
    }
  );

  // Load page data
  onPage(
    "batches",
    () =>
      Promise.all([
        loadFarmers(),
        refresh(),
        loadHiveYieldPredictions()
      ])
  );
}