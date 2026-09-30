import { api, unwrap } from "./api.js";
import { $, task, onPage } from "./app.js";


function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function number(value) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) {
    return "0";
  }

  return n.toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}


export function initAdmin() {

  const page = $("#page-admin");

  if (!page) return;


  page.innerHTML = `

    <div class="card">

      <div class="card-header">

        <div>

          <h2>Regional Dashboard</h2>

          <p class="muted">
            Select a region to view its complete
            farmer, hive, batch and honey production data.
          </p>

        </div>

        <button
          id="admin-refresh"
          class="button ghost"
          type="button"
        >
          Refresh
        </button>

      </div>


      <!-- REGION SELECTOR -->

      <div
        style="
          margin-top:20px;
          max-width:450px;
        "
      >

        <label>

          <strong>Select Region / State</strong>

          <select
            id="admin-region-select"
            style="
              width:100%;
              margin-top:8px;
              padding:12px;
              border-radius:8px;
              border:1px solid #eaded4;
              background:white;
            "
          >

            <option value="">
              Loading regions...
            </option>

          </select>

        </label>

      </div>


      <!-- RESULT -->

      <div
        id="admin-result"
        style="margin-top:25px;"
      >

        <p class="muted">
          Select a region.
        </p>

      </div>

    </div>

  `;


  const select =
    $("#admin-region-select");

  const result =
    $("#admin-result");

  const refresh =
    $("#admin-refresh");


  // ==========================================================
  // LOAD REGION LIST
  // ==========================================================

  async function loadRegions() {

    try {

      const response =
        await api.get("/api/admin/regions");

      const data =
        unwrap(response) || {};

      const regions =
  Array.isArray(data.regions)
    ? data.regions
    : (
        data.regions &&
        typeof data.regions === "object"
      )
        ? Object.keys(data.regions)
        : [];
      if (regions.length === 0) {

        select.innerHTML = `
          <option value="">
            No regions available
          </option>
        `;

        return;
      }


      select.innerHTML = `

        <option value="">
          -- Select Region --
        </option>

        ${
          regions.map(region => `
            <option value="${escapeHTML(region)}">
              ${escapeHTML(region)}
            </option>
          `).join("")
        }

      `;

    } catch (error) {

      select.innerHTML = `
        <option value="">
          Unable to load regions
        </option>
      `;

      result.innerHTML = `
        <div class="card">
          <p>
            Failed to load regions.
          </p>
          <p class="muted">
            ${escapeHTML(error.message)}
          </p>
        </div>
      `;
    }
  }


  // ==========================================================
  // LOAD SELECTED REGION
  // ==========================================================

  async function loadRegion(region) {

    if (!region) {

      result.innerHTML = `
        <p class="muted">
          Select a region to view its data.
        </p>
      `;

      return;
    }


    result.innerHTML = `
      <p class="muted">
        Loading ${escapeHTML(region)} data...
      </p>
    `;


    try {

      const response =
        await api.get(
          `/api/admin/region/${encodeURIComponent(region)}`
        );

      const data =
        unwrap(response) || {};

      const summary =
        data.summary || {};

      const farmers =
        Array.isArray(data.farmers)
          ? data.farmers
          : [];


      // ======================================================
      // SUMMARY CARDS
      // ======================================================

      const metrics = `

        <div
          class="metrics"
          style="margin-top:20px;"
        >

          <div class="metric">

            <b>
              ${number(summary.farmers)}
            </b>

            <span>
              Farmers
            </span>

          </div>


          <div class="metric">

            <b>
              ${number(summary.hives)}
            </b>

            <span>
              Hives
            </span>

          </div>


          <div class="metric">

            <b>
              ${number(summary.batches)}
            </b>

            <span>
              Batches
            </span>

          </div>


          <div class="metric">

            <b>
              ${number(summary.honey_produced_kg)} kg
            </b>

            <span>
              Honey Produced
            </span>

          </div>

        </div>

      `;


      // ======================================================
      // HIVE HEALTH
      // ======================================================

      const health = `

        <div
          class="metrics"
          style="margin-top:15px;"
        >

          <div class="metric">

            <b>
              ${number(summary.healthy_hives)}
            </b>

            <span>
              Healthy Hives
            </span>

          </div>


          <div class="metric">

            <b>
              ${number(summary.at_risk_hives)}
            </b>

            <span>
              At Risk Hives
            </span>

          </div>


          <div class="metric">

            <b>
              ${number(summary.unknown_hives)}
            </b>

            <span>
              No AI Data
            </span>

          </div>

        </div>

      `;


      // ======================================================
      // FARMER TABLE
      // ======================================================

      let farmerTable = "";


      if (farmers.length === 0) {

        farmerTable = `

          <div class="card">

            <p>
              No farmers found in
              <strong>
                ${escapeHTML(region)}
              </strong>.
            </p>

          </div>

        `;

      } else {

        farmerTable = `

          <div
            class="card"
            style="margin-top:20px;"
          >

            <h3>
              Farmers in ${escapeHTML(region)}
            </h3>


            <div
              style="
                overflow-x:auto;
                margin-top:15px;
              "
            >

              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                "
              >

                <thead>

                  <tr>

                    <th
                      style="
                        text-align:left;
                        padding:12px;
                        border-bottom:2px solid #eaded4;
                      "
                    >
                      Farmer
                    </th>


                    <th
                      style="
                        text-align:left;
                        padding:12px;
                        border-bottom:2px solid #eaded4;
                      "
                    >
                      Village
                    </th>


                    <th
                      style="
                        text-align:center;
                        padding:12px;
                        border-bottom:2px solid #eaded4;
                      "
                    >
                      Hives
                    </th>


                    <th
                      style="
                        text-align:center;
                        padding:12px;
                        border-bottom:2px solid #eaded4;
                      "
                    >
                      Batches
                    </th>


                    <th
                      style="
                        text-align:right;
                        padding:12px;
                        border-bottom:2px solid #eaded4;
                      "
                    >
                      Honey
                    </th>

                  </tr>

                </thead>


                <tbody>

                  ${
                    farmers.map(farmer => `

                      <tr>

                        <td
                          style="
                            padding:12px;
                            border-bottom:1px solid #eaded4;
                          "
                        >

                          <strong>
                            ${escapeHTML(farmer.name)}
                          </strong>

                          <br>

                          <span class="muted">
                            Age: ${escapeHTML(farmer.age)}
                          </span>

                        </td>


                        <td
                          style="
                            padding:12px;
                            border-bottom:1px solid #eaded4;
                          "
                        >
                          ${escapeHTML(farmer.village)}
                        </td>


                        <td
                          style="
                            padding:12px;
                            text-align:center;
                            border-bottom:1px solid #eaded4;
                          "
                        >
                          ${number(farmer.hives)}
                        </td>


                        <td
                          style="
                            padding:12px;
                            text-align:center;
                            border-bottom:1px solid #eaded4;
                          "
                        >
                          ${number(farmer.batches)}
                        </td>


                        <td
                          style="
                            padding:12px;
                            text-align:right;
                            border-bottom:1px solid #eaded4;
                            font-weight:600;
                          "
                        >
                          ${number(farmer.honey_produced_kg)} kg
                        </td>

                      </tr>

                    `).join("")
                  }

                </tbody>

              </table>

            </div>

          </div>

        `;

      }


      // ======================================================
      // FINAL RESULT
      // ======================================================

      result.innerHTML = `

        <div>

          <h3>
            ${escapeHTML(region)}
          </h3>

          <p class="muted">
            Consolidated data from all farmers
            registered in this region.
          </p>

        </div>


        ${metrics}

        ${health}

        ${farmerTable}

      `;

    } catch (error) {

      result.innerHTML = `

        <div class="card">

          <h3>
            Unable to load regional data
          </h3>

          <p class="muted">
            ${escapeHTML(error.message)}
          </p>

        </div>

      `;

    }

  }


  // ==========================================================
  // EVENTS
  // ==========================================================

  select.addEventListener(
    "change",
    () => {
      loadRegion(select.value);
    }
  );


  refresh.addEventListener(
    "click",
    async () => {

      await loadRegions();

      if (select.value) {
        await loadRegion(select.value);
      }

    }
  );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  onPage(
    "admin",
    async () => {

      await loadRegions();

      if (select.value) {
        await loadRegion(select.value);
      }

    }
  );


  loadRegions();
}