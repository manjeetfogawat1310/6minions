import { api, list, unwrap, segment } from "./api.js";

import {
  $,
  node,
  pick,
  number,
  date,
  details,
  raw,
  status,
  metrics,
  options,
  table,
  task,
  toast,
  formData,
  onPage,
  state,
  lineChart,
  empty
} from "./app.js";


/* =========================================================
   SCENARIOS
========================================================= */

const scenarios = {

  "Healthy Hive": {
    temperature: 34,
    humidity: 55,
    hive_weight: 42,
    audio_feature: 0.35
  },

  "Heat Stress": {
    temperature: 43,
    humidity: 38,
    hive_weight: 39,
    audio_feature: 0.72
  },

  "High Humidity": {
    temperature: 32,
    humidity: 88,
    hive_weight: 43,
    audio_feature: 0.58
  },

  "Low Weight": {
    temperature: 33,
    humidity: 57,
    hive_weight: 14,
    audio_feature: 0.48
  },

  "Disease Risk": {
    temperature: 30,
    humidity: 78,
    hive_weight: 23,
    audio_feature: 0.91
  }

};


let hives = [];
let predictionController;
let predictionVersion = 0;


/* =========================================================
   INITIALIZE HIVE PAGE
========================================================= */

export function initHive() {

  $("#page-hive").innerHTML = `

    <div class="grid two">

      <!-- SENSOR SIMULATION -->
      <div class="card">

        <div class="card-header">

          <h2>Sensor Simulation</h2>

          <span class="badge demo">
            DEMO / SIMULATED
          </span>

        </div>


        <p class="help">
          These are presentation inputs, not live hardware readings.
          Scenario names do not guarantee the AI model's result.
        </p>


        <div class="toolbar">

          <label>
            Hive

            <select id="sensor-hive" required>
              <option value="">
                Select a hive
              </option>
            </select>

          </label>


          <button
            class="button ghost"
            id="reload-hives"
            type="button"
          >
            Refresh Hives
          </button>

        </div>


        <div id="hive-load-status"></div>


        <!-- SCENARIOS -->

        <div
          class="scenarios"
          id="scenario-buttons"
        ></div>


        <!-- SENSOR FORM -->

        <form id="sensor-form">

          <div class="form-grid">

            <label>
              Temperature (C)

              <input
                name="temperature"
                type="number"
                step="any"
                required
                value="34"
              >

            </label>


            <label>
              Humidity (%)

              <input
                name="humidity"
                type="number"
                min="0"
                max="100"
                step="any"
                required
                value="55"
              >

            </label>


            


            <label>
              Audio feature (model units)

              <input
                name="audio_feature"
                type="number"
                step="any"
                required
                value="0.35"
              >

            </label>


            <!-- FIXED: only valid backend mode -->

            <label class="full">

              Request mode

              <select name="mode">

                <option value="predict">
                  Prediction only
                </option>

              </select>

            </label>

          </div>


          <div class="actions">

            <button
              class="button secondary"
              type="submit"
            >
              Run AI Prediction
            </button>

          </div>

        </form>


        <div class="actions">

          <button
            id="get-scenarios"
            class="button ghost small"
            type="button"
          >
            View Backend Scenarios
          </button>

        </div>


        <div
          id="backend-scenarios"
          class="section-gap"
        ></div>

      </div>


      <!-- AI ASSESSMENT -->

      <div class="card">

        <h2>AI Assessment</h2>

        <div
          id="prediction-result"
          aria-live="polite"
        >

          <div class="empty">
            Choose a hive and run a scenario.
            No prediction has been requested.
          </div>

        </div>

      </div>

    </div>


    <!-- REGISTER HIVE -->

    <div class="card">

      <h2>Register a Demo Hive</h2>

      <p class="help">
        Creates a backend record.
        Use a farmer ID recognized by your backend.
      </p>


      <form id="create-hive-form">

        <div class="form-grid">

          <label>

  Farmer

  <select
    id="hive-farmer"
    name="farmer_id"
    required
  >
    <option value="">
      Loading farmers...
    </option>
  </select>

</label>


          <label>

            Hive name

            <input
              name="name"
              required
            >

          </label>


          <label>

            Location

            <input
              name="location"
              required
            >

          </label>


          <label>

            Region

            <select
              name="region"
              required
            >

              <option value="Andhra Pradesh">Andhra Pradesh</option>
<option value="Arunachal Pradesh">Arunachal Pradesh</option>
<option value="Assam">Assam</option>
<option value="Bihar">Bihar</option>
<option value="Chhattisgarh">Chhattisgarh</option>
<option value="Goa">Goa</option>
<option value="Gujarat">Gujarat</option>
<option value="Haryana">Haryana</option>
<option value="Himachal Pradesh">Himachal Pradesh</option>
<option value="Jharkhand">Jharkhand</option>
<option value="Karnataka">Karnataka</option>
<option value="Kerala">Kerala</option>
<option value="Madhya Pradesh">Madhya Pradesh</option>
<option value="Maharashtra">Maharashtra</option>
<option value="Manipur">Manipur</option>
<option value="Meghalaya">Meghalaya</option>
<option value="Mizoram">Mizoram</option>
<option value="Nagaland">Nagaland</option>
<option value="Odisha">Odisha</option>
<option value="Punjab">Punjab</option>
<option value="Rajasthan">Rajasthan</option>
<option value="Sikkim">Sikkim</option>
<option value="Tamil Nadu">Tamil Nadu</option>
<option value="Telangana">Telangana</option>
<option value="Tripura">Tripura</option>
<option value="Uttar Pradesh">Uttar Pradesh</option>
<option value="Uttarakhand">Uttarakhand</option>
<option value="West Bengal">West Bengal</option>

<option value="Andaman and Nicobar Islands">
  Andaman and Nicobar Islands
</option>
<option value="Chandigarh">Chandigarh</option>
<option value="Dadra and Nagar Haveli and Daman and Diu">
  Dadra and Nagar Haveli and Daman and Diu
</option>
<option value="Delhi">Delhi</option>
<option value="Jammu and Kashmir">Jammu and Kashmir</option>
<option value="Ladakh">Ladakh</option>
<option value="Lakshadweep">Lakshadweep</option>
<option value="Puducherry">Puducherry</option>

            </select>

          </label>

        </div>


        <div class="actions">

          <button
            class="button"
            type="submit"
          >
            Create Hive
          </button>

        </div>

      </form>


      <div
        id="create-hive-result"
        class="section-gap"
      ></div>

    </div>

  `;


  /* =========================================================
     HIVE HISTORY PAGE
  ========================================================= */

  $("#page-history").innerHTML = `

    <div class="card">

      <div class="toolbar">

        <label>

          Hive

          <select id="history-hive">

            <option value="">
              Select a hive
            </option>

          </select>

        </label>


        <button
          id="load-history"
          class="button"
          type="button"
        >
          Load History
        </button>


        <button
          id="history-refresh-hives"
          class="button ghost"
          type="button"
        >
          Refresh Hives
        </button>

      </div>


      <div id="history-hive-status"></div>


      <div
        id="hive-record"
        class="section-gap"
      ></div>

    </div>


    <div class="grid two section-gap">

      <div class="card">

        <h2>Sensor History</h2>

        <div id="sensor-history"></div>

      </div>


      <div class="card">

        <h2>AI Health History</h2>

        <div id="ai-history"></div>

      </div>

    </div>

  `;


  /* =========================================================
     SCENARIO BUTTONS
  ========================================================= */

  Object.entries(scenarios).forEach(
    ([name, values]) => {

      const button = node(
        "button",
        "button ghost small",
        name
      );


      button.type = "button";


      button.addEventListener(
        "click",
        () => {

          Object.entries(values).forEach(
            ([key, value]) => {

              $("#sensor-form")
                .elements
                .namedItem(key)
                .value = value;

            }
          );


          $("#scenario-buttons")
            .querySelectorAll("button")
            .forEach(item => {

              item.classList.toggle(
                "selected",
                item === button
              );


              item.setAttribute(
                "aria-pressed",
                String(item === button)
              );

            });


          predict();

        }
      );


      button.setAttribute(
        "aria-pressed",
        "false"
      );


      $("#scenario-buttons").append(
        button
      );

    }
  );

    /* =========================================================
     LOAD FARMERS FOR HIVE REGISTRATION
  ========================================================= */

    /* =========================================================
     LOAD FARMERS FOR HIVE REGISTRATION
  ========================================================= */

  async function loadFarmersForHive() {

    const select = $("#hive-farmer");

    if (!select) {
      return;
    }

    select.innerHTML = `
      <option value="">
        Loading farmers...
      </option>
    `;

    try {

      const data = await api.get("/api/farmers");

      const farmers = Array.isArray(data)
        ? data
        : Array.isArray(data?.farmers)
          ? data.farmers
          : Array.isArray(data?.data)
            ? data.data
            : [];

      console.log("Farmers loaded for Hive:", farmers);

      if (farmers.length === 0) {

        select.innerHTML = `
          <option value="">
            No farmers registered
          </option>
        `;

        return;
      }

      select.innerHTML = `
        <option value="">
          -- Select Farmer --
        </option>

        ${farmers.map(farmer => `
          <option value="${farmer.id}">
            ${String(farmer.name ?? "Farmer")}
            — ID ${farmer.id}
            — ${String(farmer.region ?? "")}
            ${farmer.district
              ? ` — ${String(farmer.district)}`
              : ""}
          </option>
        `).join("")}
      `;

    } catch (error) {

      console.error(
        "Failed to load farmers:",
        error
      );

      select.innerHTML = `
        <option value="">
          Failed to load farmers
        </option>
      `;

      toast(
        `Could not load farmers: ${error.message}`,
        "error"
      );
    }
  }
  /* =========================================================
     LOAD ALL HIVES
  ========================================================= */

  async function loadHives(
    target = $("#hive-load-status")
  ) {

    await task(
      target,
      async () => {

        hives = list(
          await api.get("/api/hives"),
          "hives"
        );


        for (
          const id of [
            "#sensor-hive",
            "#history-hive"
          ]
        ) {

          options(
            $(id),
            hives,

            hive =>
              pick(
                hive,
                "hive_id",
                "id"
              ),

            hive =>
              `${pick(
                hive,
                "hive_id",
                "id"
              )} | ${
                pick(
                  hive,
                  "name",
                  "location"
                ) || "Hive"
              }`
          );


          if (state.hiveId) {

            $(id).value =
              state.hiveId;

          }

        }


        target.replaceChildren(
          node(
            "p",
            "help",
            `${hives.length} hive records loaded.`
          )
        );


        window.dispatchEvent(
          new CustomEvent(
            "hives:loaded",
            {
              detail: hives
            }
          )
        );

      }
    );

  }


  /* =========================================================
     CLEAR OLD PREDICTION
  ========================================================= */

  function clearPrediction() {

    predictionController?.abort();

    predictionVersion += 1;


    $("#prediction-result")
      .removeAttribute("aria-busy");


    empty(
      $("#prediction-result"),
      "Inputs changed. Run a new prediction for these values."
    );

  }


  /* =========================================================
     HIVE SELECTION
  ========================================================= */

  $("#sensor-hive").addEventListener(
    "change",
    event => {

      state.hiveId =
        event.target.value;

      clearPrediction();

    }
  );


  /* =========================================================
     CLEAR PREDICTION ON INPUT CHANGE
  ========================================================= */

  $("#sensor-form").addEventListener(
    "input",
    clearPrediction
  );


  $("#sensor-form").addEventListener(
    "change",
    clearPrediction
  );


  /* =========================================================
     AI PREDICTION
  ========================================================= */

  async function predict() {

    const form =
      $("#sensor-form");


    if (
      !$("#sensor-hive").reportValidity() ||
      !form.reportValidity()
    ) {

      return;

    }


    predictionController?.abort();


    predictionController =
      new AbortController();


    const version =
      ++predictionVersion;


    const target =
      $("#prediction-result");


    target.setAttribute(
      "aria-busy",
      "true"
    );


    target.replaceChildren(

      node(
        "div",
        "loading",
        "Requesting AI assessment for simulated inputs..."
      )

    );


    const values =
      formData(form);


    const payload = {

      hive_id:
        $("#sensor-hive").value,

      temperature:
        Number(values.temperature),

      humidity:
        Number(values.humidity),

      audio_feature:
        Number(values.audio_feature)

    };


    try {

      /*
       * IMPORTANT FIX
       *
       * Backend exposes:
       * POST /api/ai/predict
       *
       * Do NOT dynamically use:
       * /api/ai/${values.mode}
       */

      const response =
        await api.post(
          "/api/ai/predict",
          payload,
          {
            signal:
              predictionController.signal
          }
        );


      if (
        version !== predictionVersion
      ) {

        return;

      }


      const data =
        unwrap(response);


      const prediction =
        data?.prediction ??
        data?.result ??
        data;


      /* =====================================================
         AI METRIC CARDS
      ===================================================== */

      const metricGrid =
        node(
          "div",
          "metrics"
        );


      metrics(
        metricGrid,

        [

          [
            "Health score",

            pick(
              prediction,
              "health_score"
            ),

            "Backend model scale"
          ],


          [
            "Predicted honey yield",

            number(
              pick(
                prediction,
                "predicted_yield_kg",
                "predicted_honey_yield",
                "predicted_yield"
              ),
              "kg"
            ),

            "AI model estimate"
          ],


          [
            "Temperature input",

            number(
              payload.temperature,
              "C"
            ),

            "DEMO / SIMULATED"
          ],


          [
            "Humidity input",

            number(
              payload.humidity,
              "%"
            ),

            "DEMO / SIMULATED"
          ]

        ]

      );


      /* =====================================================
         DETAILED AI ASSESSMENT
      ===================================================== */

      target.replaceChildren(

        metricGrid,


        details(

          [

            [
              "Hive ID",

              payload.hive_id
            ],


            [
              "Hive weight input",

              `${number(
                payload.hive_weight,
                "kg"
              )} | DEMO / SIMULATED`
            ],


            [
              "Audio input",

              `${number(
                payload.audio_feature
              )} | DEMO / SIMULATED`
            ],


            [
              "Health status",

              status(
                pick(
                  prediction,
                  "health_status",
                  "status"
                )
              )
            ],


            [
              "Disease risk",

              status(
                pick(
                  prediction,
                  "disease_risk"
                )
              )
            ],


            [
              "Environmental stress",

              pick(
                prediction,
                "environmental_stress"
              )
            ],


            [
              "AI explanation",

              pick(
                prediction,
                "explanation",
                "ai_explanation"
              )
            ]

          ]

        ),


        raw(response)

      );


    } catch (error) {


      if (
        version !== predictionVersion ||
        error.name === "AbortError"
      ) {

        return;

      }


      target.replaceChildren(

        node(
          "div",
          "error-box",
          error.message
        )

      );


      toast(
        error.message,
        "error"
      );


    } finally {


      if (
        version === predictionVersion
      ) {

        target.removeAttribute(
          "aria-busy"
        );

      }

    }

  }


  /* =========================================================
     PREDICTION SUBMIT
  ========================================================= */

  $("#sensor-form").addEventListener(
    "submit",
    event => {

      event.preventDefault();

      predict();

    }
  );


  /* =========================================================
     REFRESH HIVES
  ========================================================= */

  $("#reload-hives").addEventListener(
    "click",
    () => loadHives()
  );


  $("#history-refresh-hives")
    .addEventListener(
      "click",
      () =>
        loadHives(
          $("#history-hive-status")
        )
    );


  /* =========================================================
     BACKEND SCENARIOS
  ========================================================= */

  $("#get-scenarios").addEventListener(
    "click",
    event => {

      task(

        $("#backend-scenarios"),

        async () => {

          $("#backend-scenarios")
            .replaceChildren(

              raw(
                await api.get(
                  "/api/ai/scenarios"
                )
              )

            );

        },

        event.currentTarget

      );

    }
  );


  /* =========================================================
     CREATE HIVE
  ========================================================= */

  $("#create-hive-form").addEventListener(
    "submit",
    event => {

      event.preventDefault();


      task(

        $("#create-hive-result"),

        async () => {

          const payload = formData(event.target);

payload.farmer_id = Number(payload.farmer_id);

if (
  !Number.isInteger(payload.farmer_id) ||
  payload.farmer_id <= 0
) {
  throw new Error("Please select a valid farmer.");
}

const response =
  await api.post(
    "/api/hives",
    payload
  );


          $("#create-hive-result")
            .replaceChildren(
              raw(response)
            );


          toast(
            "The backend accepted the hive creation request."
          );


          await loadHives();

        },

        event.submitter

      );

    }
  );


  /* =========================================================
     HIVE HISTORY
  ========================================================= */

  $("#load-history").addEventListener(
    "click",
    async event => {

      const id =
        $("#history-hive").value;


      if (!id) {

        return toast(
          "Select a hive first.",
          "error"
        );

      }


      state.hiveId = id;


      const button =
        event.currentTarget;


      button.disabled = true;


      await Promise.all([

        /* ===================================================
           HIVE RECORD
        =================================================== */

        task(

          $("#hive-record"),

          async () => {

            const response =
              await api.get(
                `/api/hives/${segment(id)}`
              );


            $("#hive-record")
              .replaceChildren(

                node(
                  "h3",
                  "",
                  `Hive ${id}`
                ),

                raw(response)

              );

          }

        ),


        /* ===================================================
           SENSOR HISTORY
        =================================================== */

        task(

          $("#sensor-history"),

          async () => {

            const response =
              await api.get(
                `/api/hives/${segment(id)}/history`
              );


            const rows =
              list(
                response,
                "history",
                "sensor_history",
                "readings"
              );


            const chart =
              node(
                "div",
                "chart"
              );


            lineChart(
              chart,
              rows,
              "temperature",
              "Temperature History (C)"
            );


            $("#sensor-history")
              .replaceChildren(

                chart,


                table(

                  [

                    [
                      "Hive",

                      row =>
                        row.hive_id ?? id
                    ],


                    [
                      "Timestamp",

                      row =>
                        date(
                          pick(
                            row,
                            "timestamp",
                            "created_at"
                          )
                        )
                    ],


                    [
                      "Temperature",

                      row =>
                        pick(
                          row,
                          "temperature",
                          "sensor_data.temperature"
                        )
                    ],


                    [
                      "Humidity",

                      row =>
                        pick(
                          row,
                          "humidity",
                          "sensor_data.humidity"
                        )
                    ],


                    [
                      "Weight",

                      row =>
                        pick(
                          row,
                          "hive_weight",
                          "weight",
                          "sensor_data.hive_weight"
                        )
                    ],


                    [
                      "Audio",

                      row =>
                        pick(
                          row,
                          "audio_feature",
                          "sensor_data.audio_feature"
                        )
                    ],


                    [
                      "Health score",

                      row =>
                        pick(
                          row,
                          "health_score",
                          "prediction.health_score"
                        )
                    ],


                    [
                      "Disease risk",

                      row =>
                        status(
                          pick(
                            row,
                            "disease_risk",
                            "prediction.disease_risk"
                          )
                        )
                    ]

                  ],

                  rows

                ),


                raw(response)

              );

          }

        ),


        /* ===================================================
           AI HISTORY
        =================================================== */

        task(

          $("#ai-history"),

          async () => {

            const response =
              await api.get(
                `/api/ai/history/${segment(id)}`
              );


            const rows =
              list(
                response,
                "history",
                "predictions",
                "ai_history"
              );


            const chart =
              node(
                "div",
                "chart"
              );


            lineChart(
              chart,
              rows,
              "health_score",
              "Health Score History"
            );


            $("#ai-history")
              .replaceChildren(

                chart,


                table(

                  [

                    [
                      "Hive",

                      row =>
                        row.hive_id ?? id
                    ],


                    [
                      "Timestamp",

                      row =>
                        date(
                          pick(
                            row,
                            "timestamp",
                            "created_at"
                          )
                        )
                    ],


                    [
                      "Health score",

                      row =>
                        pick(
                          row,
                          "health_score",
                          "prediction.health_score"
                        )
                    ],


                    [
                      "Health",

                      row =>
                        status(
                          pick(
                            row,
                            "health_status",
                            "prediction.health_status"
                          )
                        )
                    ],


                    [
                      "Disease risk",

                      row =>
                        status(
                          pick(
                            row,
                            "disease_risk",
                            "prediction.disease_risk"
                          )
                        )
                    ]

                  ],

                  rows

                ),


                raw(response)

              );

          }

        )

      ]);


      button.disabled = false;

    }

  );


  /* =========================================================
     PAGE LOADERS
  ========================================================= */

    /* =========================================================
     PAGE LOADERS
  ========================================================= */

  loadFarmersForHive();

  onPage(
    "hive",
    async () => {

      await loadFarmersForHive();

      await loadHives();

    }
  );


  onPage(
    "history",
    () =>
      loadHives(
        $("#history-hive-status")
      )
  );

}
