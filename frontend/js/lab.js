// frontend/js/lab.js

export function initLab() {
  const page = document.querySelector("#page-lab");

  if (!page) {
    console.error("Lab page container not found.");
    return;
  }

  // Check the current logged-in user role from localStorage
  const userType = localStorage.getItem("honeychain_user_type") || "unknown";
  
  // Decide if upload form should be shown based on role
  const canUpload = userType === "admin";

  page.innerHTML = `
    <div class="page-heading">
      <div>
        <p class="eyebrow">CONNECTED HIVES. TRANSPARENT HONEY.</p>
        <h2>Lab Reports</h2>
        <p>Upload evidence and compare report hashes through the backend.</p>
      </div>

      <button id="lab-refresh" class="button secondary" type="button">
        Refresh Batches
      </button>
    </div>

    <div class="notice">
      Verification is displayed only when explicitly confirmed by the backend.
      Missing records and unavailable blockchain services are never treated as verified.
    </div>

    <div class="grid two section-gap">

      <!-- LEFT: Upload (Conditional) -->
      ${canUpload ? `
      <div class="card" id="upload-section">
        <h2>Upload Lab Report</h2>

        <p class="help">
          The original report file is sent to the backend.
          The backend calculates a SHA-256 hash and stores the report record.
          Blockchain verification is checked separately after upload.
        </p>

        <form id="lab-form">

          <div class="form-grid">

            <label>
              Honey Batch
              <select id="lab-batch" name="batch_id" required>
                <option value="">Loading batches...</option>
              </select>
            </label>

            <label>
              Report Number
              <input
                id="lab-report-number"
                name="report_number"
                type="text"
                placeholder="e.g. LAB-001"
                required
              >
            </label>

            <label>
              Report Type
              <input
                id="lab-report-type"
                name="report_type"
                type="text"
                placeholder="e.g. Purity Analysis"
                required
              >
            </label>

            <label>
              Report File
              <input
                id="lab-file"
                name="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                required
              >
            </label>

          </div>

          <div class="actions">
            <button
              id="lab-upload-button"
              class="button secondary"
              type="submit"
            >
              Upload Report
            </button>
          </div>

        </form>

        <div id="lab-upload-result" class="section-gap"></div>
      </div>
      ` : `
      <div class="card" id="upload-section">
        <h2>Upload Lab Report</h2>
        <div class="notice" style="margin-top: 1rem;">
          <strong>Access Restricted:</strong> 
          Only authorized Lab Technicians and Regional Admins can upload official lab evidence.
        </div>
      </div>
      `}


      <!-- RIGHT: Existing Report (Always visible) -->
      <div class="card">

        <h2>Report Evidence</h2>

        <p class="help">
          Select a batch and load its stored laboratory evidence.
        </p>

        <!-- Hidden select for Farmers if they can't see the upload form one -->
        ${!canUpload ? `
          <div style="margin-bottom: 15px;">
            <label style="display:block; margin-bottom:5px; font-weight:bold;">Select Honey Batch</label>
            <select id="lab-batch" name="batch_id" style="width:100%; padding:8px;" required>
              <option value="">Loading batches...</option>
            </select>
          </div>
        ` : ''}

        <button id="lab-load" class="button ghost" type="button">
          Load Report
        </button>

        <div id="lab-record" class="section-gap">
          <div class="empty">
            Select a batch and click Load Report.
          </div>
        </div>

        <div class="actions section-gap">
          <button id="lab-verify" class="button" type="button">
            Verify Report Hash
          </button>
        </div>

        <div id="lab-verification" class="section-gap"></div>

      </div>

    </div>
  `;

  const batchSelect = document.querySelector("#lab-batch");
  const form = document.querySelector("#lab-form");
  const loadButton = document.querySelector("#lab-load");
  const refreshButton = document.querySelector("#lab-refresh");
  const verifyButton = document.querySelector("#lab-verify");

  const recordBox = document.querySelector("#lab-record");
  const uploadResult = document.querySelector("#lab-upload-result");
  const verificationBox = document.querySelector("#lab-verification");


  // ------------------------------------------------------------
  // API helper
  // ------------------------------------------------------------

  // ------------------------------------------------------------
  // API helper
  // ------------------------------------------------------------

  async function api(url, options = {}) {
    // 1. Local storage se user data nikal aur ID (token) extract kar
    let token = null;
    const userString = localStorage.getItem('honeychain_user');
    
    if (userString) {
      try {
        const userObj = JSON.parse(userString);
        token = userObj.id; // Yahan se tera ID nikal aayega
      } catch (e) {
        console.error("Error parsing user data", e);
      }
    }

    const headers = {
      ...options.headers
    };

    // 2. Token ko headers mein daal de
    if (token) {
      headers['Authorization'] = `Bearer ${token}`; 
    }

    // 3. Naye headers ke sath fetch call maar
    const response = await fetch(apiURL(url), {
      cache: "no-store",
      ...options,
      headers: headers
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      let message =
        data.detail ??
        data.message ??
        data.error ??
        "";

      if (Array.isArray(message)) {
        message = message
          .map(item => {
            const field = Array.isArray(item.loc)
              ? item.loc.join(".")
              : "Request";
            return `${field}: ${item.msg || "Invalid value"}`;
          })
          .join("; ");
      }

      if (message && typeof message === "object") {
        message = JSON.stringify(message);
      }

      throw new Error(
        String(message || `Request failed with status ${response.status}`)
      );
    }

    return data;
  }
  // ------------------------------------------------------------
  // HTML escaping
  // ------------------------------------------------------------

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  // ------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------

  function showError(container, message) {
    if(!container) return;
    container.innerHTML = `
      <div class="notice error">
        ${escapeHtml(message)}
      </div>
    `;
  }


  function showSuccess(container, message) {
    if(!container) return;
    container.innerHTML = `
      <div class="notice success">
        ${escapeHtml(message)}
      </div>
    `;
  }


  // ------------------------------------------------------------
  // Normalize API arrays
  // ------------------------------------------------------------

  function getRows(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.batches)) return data.batches;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.reports)) return data.reports;
    return [];
  }


  // ------------------------------------------------------------
  // Load batches
  // ------------------------------------------------------------

  async function loadBatches() {
    if(!batchSelect) return;
    
    batchSelect.innerHTML = `
      <option value="">Loading batches...</option>
    `;

    try {
      const data = await api("/api/batches");
      const batches = getRows(data);

      if (!batches.length) {
        batchSelect.innerHTML = `
          <option value="">No batches available</option>
        `;
        return;
      }

      batchSelect.innerHTML = `
        <option value="">Select a batch</option>
      `;

      batches.forEach(batch => {
        const id = batch.batch_id ?? batch.id ?? batch.batch_code;
        if (!id) return;
        const option = document.createElement("option");
        option.value = id;
        option.textContent = `${id} | ${batch.honey_type ?? batch.honeyType ?? "Honey"}`;
        batchSelect.appendChild(option);
      });

      const selectedBatch = localStorage.getItem("honeyChainSelectedBatch");
      if (
        selectedBatch &&
        [...batchSelect.options].some(option => option.value === selectedBatch)
      ) {
        batchSelect.value = selectedBatch;
      }

    } catch (error) {
      batchSelect.innerHTML = `
        <option value="">Unable to load batches</option>
      `;
      if(uploadResult) {
        showError(uploadResult, `Could not load batches: ${error.message}`);
      } else {
        showError(recordBox, `Could not load batches: ${error.message}`);
      }
    }
  }


  // ------------------------------------------------------------
  // Load existing report
  // ------------------------------------------------------------

  async function loadReport() {
    if(!batchSelect) return;
    const batchId = batchSelect.value;

    if (!batchId) {
      showError(recordBox, "Please select a honey batch first.");
      return;
    }

    localStorage.setItem("honeyChainSelectedBatch", batchId);
    
    recordBox.innerHTML = `
      <div class="empty">
        Loading laboratory report...
      </div>
    `;
    
    verificationBox.innerHTML = "";

    try {
      const data = await api(`/api/lab/reports/${encodeURIComponent(batchId)}`);
      const reports = getRows(data);

      if (!reports.length) {
        recordBox.innerHTML = `
          <div class="empty">
            No laboratory report has been uploaded for
            <strong>${escapeHtml(batchId)}</strong>.
          </div>
        `;
        return;
      }

      recordBox.innerHTML = reports
        .map(report => {
          const reportNumber = report.report_number ?? report.reportNumber ?? "N/A";
          const reportType = report.report_type ?? report.reportType ?? report.laboratory ?? "Laboratory Report";
          const hash = report.sha256_hash ?? report.sha256 ?? report.data_hash ?? report.hash ?? "Not available";
          const created = report.created_at ?? report.timestamp ?? report.uploaded_at ?? report.test_date ?? "Not available";
          const blockchainTx = report.blockchain_tx_hash ?? report.transaction_hash ?? report.tx_hash ?? null;

          return `
            <div class="details">
              <div class="detail-row">
                <span>Batch ID</span>
                <strong>${escapeHtml(batchId)}</strong>
              </div>
              <div class="detail-row">
                <span>Report Number</span>
                <strong>${escapeHtml(reportNumber)}</strong>
              </div>
              <div class="detail-row">
                <span>Report Type</span>
                <strong>${escapeHtml(reportType)}</strong>
              </div>
              <div class="detail-row">
                <span>SHA-256 Hash</span>
                <strong style="word-break:break-all;">${escapeHtml(hash)}</strong>
              </div>
              <div class="detail-row">
                <span>Uploaded</span>
                <strong>${escapeHtml(created)}</strong>
              </div>
              <div class="detail-row">
                <span>Blockchain Transaction</span>
                <strong style="word-break:break-all;">
                  ${blockchainTx ? escapeHtml(blockchainTx) : "Not anchored"}
                </strong>
              </div>
            </div>
          `;
        })
        .join("");

    } catch (error) {
      showError(recordBox, `Could not load laboratory report: ${error.message}`);
    }
  }


  // ------------------------------------------------------------
  // Upload report
  // ------------------------------------------------------------

  async function uploadReport(event) {
    event.preventDefault();

    if(!canUpload) return; // Failsafe

    const batchId = batchSelect.value;
    const reportNumber = document.querySelector("#lab-report-number").value.trim();
    const reportType = document.querySelector("#lab-report-type").value.trim();
    const fileInput = document.querySelector("#lab-file");

    if (!batchId) { showError(uploadResult, "Please select a honey batch."); return; }
    if (!reportNumber) { showError(uploadResult, "Please enter a report number."); return; }
    if (!reportType) { showError(uploadResult, "Please enter a report type."); return; }
    if (!fileInput.files.length) { showError(uploadResult, "Please select a report file."); return; }

    const file = fileInput.files[0];
    const button = document.querySelector("#lab-upload-button");

    button.disabled = true;
    button.textContent = "Uploading...";
    uploadResult.innerHTML = "";

    try {
      const formData = new FormData();
      formData.append("batch_id", batchId);
      formData.append("report_number", reportNumber);
      formData.append("laboratory", `Honey Chain Academic Lab - ${reportType}`);
      formData.append("test_date", new Date().toISOString().split("T")[0]);
      formData.append("file", file);

      const data = await api("/api/lab/upload", {
        method: "POST",
        body: formData
      });

      const hash = data.hash ?? data.report?.sha256_hash ?? data.report?.sha256 ?? "Generated by backend";
      showSuccess(uploadResult, `Lab report ${reportNumber} uploaded successfully. SHA-256 generated.`);

      document.querySelector("#lab-report-number").value = "";
      document.querySelector("#lab-report-type").value = "";
      fileInput.value = "";
      batchSelect.value = batchId;

      await loadReport();

      if (hash && hash !== "Generated by backend") {
        uploadResult.innerHTML += `
          <div class="notice section-gap">
            <strong>SHA-256:</strong>
            <div style="word-break:break-all;margin-top:8px;">
              ${escapeHtml(hash)}
            </div>
          </div>
        `;
      }
    } catch (error) {
      showError(uploadResult, `Upload failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "Upload Report";
    }
  }


  // ------------------------------------------------------------
  // Verify report hash
  // ------------------------------------------------------------

  async function verifyReport() {
    if(!batchSelect) return;
    const batchId = batchSelect.value;

    if (!batchId) {
      showError(verificationBox, "Please select a honey batch first.");
      return;
    }

    verificationBox.innerHTML = `
      <div class="empty">
        Verifying report hash...
      </div>
    `;

    try {
      const reportData = await api(`/api/lab/reports/${encodeURIComponent(batchId)}`);
      const reports = getRows(reportData);

      if (!reports.length) {
        showError(verificationBox, "No laboratory report exists for this batch.");
        return;
      }

      const report = reports[reports.length - 1];
      const reportNumber = report.report_number ?? report.reportNumber;

      if (!reportNumber) {
        showError(verificationBox, "Report number is missing from the backend record.");
        return;
      }

      const result = await api(`/api/lab/verify/${encodeURIComponent(batchId)}/${encodeURIComponent(reportNumber)}`);

      const offChainVerified = result.verified_off_chain === true || result.hash_match === true || result.hash_matches === true || result.sha256_match === true;
      const blockchainVerified = result.blockchain_verified === true;
      const calculatedHash = result.calculated_hash ?? "Not available";
      const storedHash = result.stored_hash ?? report.sha256_hash ?? "Not available";
      const blockchainRecord = result.blockchain_record;

      if (offChainVerified) {
        verificationBox.innerHTML = `
          <div class="notice success">
            <strong>SHA-256 HASH MATCH</strong>
            <p>The backend confirmed that the uploaded report matches its stored SHA-256 hash.</p>
            <div style="margin-top:12px;"><strong>Calculated hash:</strong><div style="word-break:break-all;">${escapeHtml(calculatedHash)}</div></div>
            <div style="margin-top:12px;"><strong>Stored hash:</strong><div style="word-break:break-all;">${escapeHtml(storedHash)}</div></div>
          </div>
        `;
      } else {
        verificationBox.innerHTML = `
          <div class="notice error">
            <strong>HASH MISMATCH</strong>
            <p>The backend could not confirm that the calculated report hash matches the stored hash.</p>
            <div style="margin-top:12px;"><strong>Calculated:</strong><div style="word-break:break-all;">${escapeHtml(calculatedHash)}</div></div>
            <div style="margin-top:12px;"><strong>Stored:</strong><div style="word-break:break-all;">${escapeHtml(storedHash)}</div></div>
          </div>
        `;
      }

      if (blockchainVerified) {
        verificationBox.innerHTML += `
          <div class="notice success section-gap">
            <strong>BLOCKCHAIN VERIFIED</strong>
            <p>The SHA-256 hash was also confirmed against the configured blockchain record.</p>
            ${blockchainRecord ? `<div style="margin-top:12px;"><strong>Blockchain record:</strong><pre style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(JSON.stringify(blockchainRecord, null, 2))}</pre></div>` : ""}
          </div>
        `;
      } else {
        verificationBox.innerHTML += `
          <div class="notice section-gap">
            <strong>BLOCKCHAIN NOT VERIFIED</strong>
            <p>The off-chain SHA-256 check may be successful, but the backend did not confirm a matching blockchain record for this report.</p>
            <p>This record is therefore <strong>not treated as blockchain verified</strong>.</p>
          </div>
        `;
      }

    } catch (error) {
      showError(verificationBox, `Verification unavailable: ${error.message}`);
    }
  }


  // ------------------------------------------------------------
  // Event listeners
  // ------------------------------------------------------------

  if(form) {
    form.addEventListener("submit", uploadReport);
  }

  if(loadButton) {
    loadButton.addEventListener("click", loadReport);
  }

  if(verifyButton) {
    verifyButton.addEventListener("click", verifyReport);
  }

  if(refreshButton) {
    refreshButton.addEventListener("click", async () => {
      if(uploadResult) uploadResult.innerHTML = "";
      if(verificationBox) verificationBox.innerHTML = "";
      await loadBatches();
    });
  }

  if(batchSelect) {
    batchSelect.addEventListener("change", () => {
      if (batchSelect.value) {
        localStorage.setItem("honeyChainSelectedBatch", batchSelect.value);
      }
    });
  }

  // Initial load
  loadBatches();
}