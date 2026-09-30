import { api, unwrap, segment } from "./api.js";
import {
  $,
  node,
  task,
  raw,
  onPage,
  selectBatch,
  details,
  verificationBadge,
  blockchainValue,
  date,
  status
} from "./app.js";

export function initVerification() {
  const page = $("#page-verification");

  page.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">CONSUMER TRANSPARENCY</p>
        <h2>Consumer Verification</h2>
        <p>
          Verify honey batch information, laboratory evidence,
          traceability and blockchain status.
        </p>
      </div>
    </div>

    <div class="notice">
      Blockchain verification is shown only when the backend confirms
      the record against the configured blockchain.
    </div>

    <div class="grid two section-gap">

      <!-- Verification input -->
      <div class="card">
        <h2>Verify Honey Batch</h2>

        <p class="help">
          Enter a batch ID to retrieve its complete traceability record.
        </p>

        <form id="verify-form">

          <div class="form-grid">

            <label class="full">
              Batch ID
              <input
                name="batch_id"
                value="DEMO-001"
                placeholder="e.g. DEMO-001"
                required
              >
            </label>

          </div>

          <div class="actions">
            <button
              id="verify-button"
              class="button"
              type="submit"
            >
              Verify Batch
            </button>
          </div>

        </form>

        <div id="verify-message" class="section-gap"></div>
      </div>


      <!-- Verification status -->
      <div class="card">
        <h2>Verification Status</h2>

        <div id="verification-status">
          <div class="empty">
            Enter a batch ID and click Verify Batch.
          </div>
        </div>
      </div>

    </div>


    <!-- Batch information -->
    <div class="card section-gap">
      <h2>Batch Information</h2>
      <div id="batch-information">
        <div class="empty">
          No batch loaded.
        </div>
      </div>
    </div>


    <!-- Lab information -->
    <div class="card section-gap">
      <h2>Laboratory Evidence</h2>
      <div id="lab-information">
        <div class="empty">
          No laboratory information loaded.
        </div>
      </div>
    </div>


    <!-- Traceability -->
    <div class="card section-gap">
      <h2>Supply Chain Traceability</h2>
      <div id="traceability-information">
        <div class="empty">
          No traceability information loaded.
        </div>
      </div>
    </div>


    <!-- Raw backend response -->
    <div id="verification-raw" class="section-gap"></div>
  `;


  const form = $("#verify-form");
  const button = $("#verify-button");

  const messageBox = $("#verify-message");
  const statusBox = $("#verification-status");
  const batchBox = $("#batch-information");
  const labBox = $("#lab-information");
  const traceBox = $("#traceability-information");
  const rawBox = $("#verification-raw");


  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function clearResults() {
    statusBox.innerHTML = `
      <div class="empty">
        No verification result.
      </div>
    `;

    batchBox.innerHTML = `
      <div class="empty">
        No batch loaded.
      </div>
    `;

    labBox.innerHTML = `
      <div class="empty">
        No laboratory information loaded.
      </div>
    `;

    traceBox.innerHTML = `
      <div class="empty">
        No traceability information loaded.
      </div>
    `;

    rawBox.replaceChildren();
  }


  function renderStatus(data) {
    const batch = data?.batch ?? {};

    /*
     * IMPORTANT:
     *
     * `verified` is the final verification result returned
     * by the backend.
     *
     * We do NOT use batch.blockchain_status alone because
     * the database may contain a seeded "VERIFIED" value even
     * when actual blockchain verification is unavailable.
     */
    const verified = data?.verified === true;

    const source =
      data?.verification_source ??
      "unknown";

    const blockchainBatch =
      data?.blockchain_batch ?? null;

    const transactionHash =
      batch?.transaction_hash ??
      batch?.blockchain_transaction_hash ??
      null;


    const title = verified
      ? "ON-CHAIN VERIFIED"
      : "BLOCKCHAIN NOT VERIFIED";


    const message = verified
      ? `
        <div class="notice success">

          <strong>${title}</strong>

          <p>
            The backend confirmed this batch against
            the configured blockchain record.
          </p>

          ${
            transactionHash
              ? `
                <p>
                  <strong>Transaction hash:</strong>
                  <br>
                  <span style="word-break:break-all;">
                    ${escapeHtml(transactionHash)}
                  </span>
                </p>
              `
              : ""
          }

        </div>
      `
      : `
        <div class="notice">

          <strong>${title}</strong>

          <p>
            The database record was found, but the backend
            did not confirm this batch against the blockchain.
          </p>

          <p>
            <strong>Verification source:</strong>
            ${escapeHtml(source)}
          </p>

          ${
            transactionHash
              ? `
                <p>
                  <strong>Stored transaction hash:</strong>
                  <br>
                  <span style="word-break:break-all;">
                    ${escapeHtml(transactionHash)}
                  </span>
                </p>
              `
              : ""
          }

        </div>
      `;


    const databaseStatus =
      batch?.blockchain_status ??
      "Not available";


    const blockchainRecord =
      blockchainBatch
        ? JSON.stringify(blockchainBatch, null, 2)
        : "No blockchain record returned by backend.";


    statusBox.innerHTML = `
      ${message}

      <div class="details section-gap">

        <div>
          <dt>Final verification</dt>
          <dd>
            ${
              verified
                ? "Blockchain verified"
                : "Not blockchain verified"
            }
          </dd>
        </div>

        <div>
          <dt>Verification source</dt>
          <dd>${escapeHtml(source)}</dd>
        </div>

        <div>
          <dt>Database blockchain status</dt>
          <dd>${escapeHtml(databaseStatus)}</dd>
        </div>

        <div>
          <dt>Blockchain record</dt>
          <dd>
            ${
              blockchainBatch
                ? "Returned by backend"
                : "Not available"
            }
          </dd>
        </div>

      </div>

      ${
        blockchainBatch
          ? `
            <details class="raw">
              <summary>Blockchain record</summary>
              <pre>${escapeHtml(blockchainRecord)}</pre>
            </details>
          `
          : ""
      }
    `;
  }


  function renderBatch(data) {
    const batch = data?.batch;

    if (!batch) {
      batchBox.innerHTML = `
        <div class="empty">
          Backend did not return batch information.
        </div>
      `;
      return;
    }


    batchBox.replaceChildren(
      details([
        ["Batch ID", batch.batch_id ?? batch.id],
        ["Hive ID", batch.hive_id],
        ["Farmer ID", batch.farmer_id],
        ["Honey type", batch.honey_type],
        ["Quantity", batch.quantity_kg ?? batch.quantity, "kg"],
        ["Available quantity", batch.available_quantity, "kg"],
        ["Harvest date", batch.harvest_date],
        ["Location", batch.location],
        ["Current location", batch.current_location],
        ["Region", batch.region],
        ["Current owner", batch.current_owner],
        ["Status", batch.status],
        ["AI health", status(batch.ai_health_status)],
        ["Disease risk", batch.ai_disease_risk],
        ["Predicted yield", batch.ai_predicted_yield, "kg"],
        ["Blockchain transaction", batch.transaction_hash]
      ])
    );
  }


  function renderLab(data) {
    const report = data?.batch?.lab_report;

    if (!report) {
      labBox.innerHTML = `
        <div class="empty">
          No laboratory report is attached to this batch.
        </div>
      `;
      return;
    }


    labBox.innerHTML = `
      <div class="details">

        <div>
          <dt>Report Number</dt>
          <dd>${escapeHtml(report.report_number ?? "Unavailable")}</dd>
        </div>

        <div>
          <dt>Laboratory</dt>
          <dd>${escapeHtml(report.laboratory ?? "Unavailable")}</dd>
        </div>

        <div>
          <dt>Test Date</dt>
          <dd>${escapeHtml(report.test_date ?? "Unavailable")}</dd>
        </div>

        <div>
          <dt>Quality Grade</dt>
          <dd>${escapeHtml(report.quality_grade ?? "Unavailable")}</dd>
        </div>

        <div>
          <dt>SHA-256 Hash</dt>
          <dd style="word-break:break-all;">
            ${escapeHtml(report.sha256_hash ?? "Unavailable")}
          </dd>
        </div>

        <div>
          <dt>Blockchain Transaction</dt>
          <dd style="word-break:break-all;">
            ${
              report.blockchain_tx_hash
                ? escapeHtml(report.blockchain_tx_hash)
                : "Not anchored"
            }
          </dd>
        </div>

      </div>
    `;
  }


  function renderTraceability(data) {
    const events = data?.batch?.traceability;

    if (!Array.isArray(events) || !events.length) {
      traceBox.innerHTML = `
        <div class="empty">
          No traceability events returned by the backend.
        </div>
      `;
      return;
    }


    const list = node("ol", "timeline");


    events.forEach(event => {

      const item = node("li");

      const eventType =
        event.event_type ??
        event.type ??
        "Event";


      const from =
        event.from_party ??
        event.from_entity ??
        event.from ??
        "Unavailable";


      const to =
        event.to_party ??
        event.to_entity ??
        event.to ??
        "Unavailable";


      const location =
        event.location ??
        "Unavailable";


      const timestamp =
        event.timestamp ??
        event.created_at ??
        null;


      const tx =
        event.blockchain_tx_hash ??
        event.transaction_hash ??
        event.tx_hash ??
        null;


      const description =
        event.metadata?.description ??
        event.description ??
        "";


      item.append(
        node("h3", "", eventType)
      );


      const eventDetails = details([
        ["From", from],
        ["To", to],
        ["Location", location],
        ["Timestamp", timestamp ? date(timestamp) : "Unavailable"],
        [
          "Blockchain transaction",
          tx || "Not available"
        ]
      ]);


      item.append(eventDetails);


      if (description) {
        item.append(
          node(
            "p",
            "help",
            description
          )
        );
      }


      list.append(item);
    });


    traceBox.replaceChildren(list);
  }


  async function verifyBatch(event) {
    event.preventDefault();

    const formData = new FormData(form);

    const id =
      String(formData.get("batch_id") ?? "")
        .trim();


    if (!id) {
      messageBox.innerHTML = `
        <div class="notice error">
          Please enter a batch ID.
        </div>
      `;
      return;
    }


    clearResults();


    await task(
      messageBox,
      async () => {

        const response =
          await api.get(
            `/api/verify/${segment(id)}`
          );


        const data =
          unwrap(response);


        /*
         * Keep selected batch synchronized
         * with the rest of the application.
         */
        selectBatch(id);


        /*
         * Render all verification information.
         */
        renderStatus(data);
        renderBatch(data);
        renderLab(data);
        renderTraceability(data);


        /*
         * Show backend response for debugging/demo.
         */
        rawBox.replaceChildren(
          raw(response)
        );


        const verified =
          data?.verified === true;


        messageBox.innerHTML = verified
          ? `
            <div class="notice success">
              Batch <strong>${escapeHtml(id)}</strong>
              was confirmed by the backend against the blockchain.
            </div>
          `
          : `
            <div class="notice">
              Batch <strong>${escapeHtml(id)}</strong>
              was found in the database, but blockchain verification
              was not confirmed by the backend.
            </div>
          `;
      },
      button
    );
  }


  form.addEventListener(
    "submit",
    verifyBatch
  );


  onPage(
    "verification",
    () => {}
  );
}