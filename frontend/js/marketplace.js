import { api } from "./api.js";

export function initMarketplace() {
  const page = document.querySelector("#page-marketplace");

  if (!page) return;

  page.innerHTML = `
    <div class="notice">
      DEMO / SIMULATED: Price and distance are illustrative estimates.
      No real purchase or payment is performed.
    </div>

    <div class="card">
      <h2>Buyer Marketplace</h2>

      <form id="market-filters">
        <div class="form-grid">

          <label>
            Region
            <select name="region">

              <option value="">All India</option>

              <!-- STATES -->

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

              <!-- UNION TERRITORIES -->

              <option value="Andaman and Nicobar Islands">
                Andaman and Nicobar Islands
              </option>

              <option value="Chandigarh">
                Chandigarh
              </option>

              <option value="Dadra and Nagar Haveli and Daman and Diu">
                Dadra and Nagar Haveli and Daman and Diu
              </option>

              <option value="Delhi">
                Delhi
              </option>

              <option value="Jammu and Kashmir">
                Jammu and Kashmir
              </option>

              <option value="Ladakh">
                Ladakh
              </option>

              <option value="Lakshadweep">
                Lakshadweep
              </option>

              <option value="Puducherry">
                Puducherry
              </option>

            </select>
          </label>

          <label>
            Honey Type
            <input
              name="honey_type"
              placeholder="Any honey type"
            >
          </label>

          <label>
            Minimum Quantity (kg)
            <input
              name="min_quantity"
              type="number"
              min="0"
              step="0.1"
            >
          </label>

        </div>

        <div class="actions">

          <button
            type="submit"
            class="button"
          >
            Search
          </button>

          <button
            type="reset"
            class="button ghost"
          >
            Clear
          </button>

        </div>
      </form>
    </div>

    <div class="section-gap">
      <p id="market-count" class="muted"></p>
      <div id="market-results"></div>
    </div>
  `;

  const form = document.querySelector("#market-filters");
  const results = document.querySelector("#market-results");
  const count = document.querySelector("#market-count");

  async function loadMarketplace() {
  results.innerHTML = "<p>Loading marketplace...</p>";

  try {
    const data = await api.get("/api/marketplace/batches");

    const batches = Array.isArray(data)
      ? data
      : (data.batches || data.items || data.results || []);

    // Get current filters
    const formData = new FormData(form);

    const selectedRegion =
      String(formData.get("region") || "").trim();

    const selectedHoneyType =
      String(formData.get("honey_type") || "")
        .trim()
        .toLowerCase();

    const minQuantity =
      parseFloat(formData.get("min_quantity") || "0");

    // Apply filters
    const filteredBatches = batches.filter(batch => {

      // Region filter
      if (
        selectedRegion &&
        String(batch.region || "").trim() !== selectedRegion
      ) {
        return false;
      }

      // Honey type filter
      if (
        selectedHoneyType &&
        !String(batch.honey_type || "")
          .toLowerCase()
          .includes(selectedHoneyType)
      ) {
        return false;
      }

      // Minimum quantity filter
      const quantity = parseFloat(
        batch.available_quantity ??
        batch.quantity ??
        0
      );

      if (quantity < minQuantity) {
        return false;
      }

      return true;
    });

    // Show filtered count
    count.textContent =
      `${filteredBatches.length} batch record(s) found.`;

    // Nothing found
    if (filteredBatches.length === 0) {
      results.innerHTML = `
        <div class="card">
          <p>No honey batches match the selected filters.</p>
        </div>
      `;
      return;
    }

    // Display filtered batches
    results.innerHTML = filteredBatches.map(batch => `
      <div class="card">

        <h3>
          ${escapeHTML(
            batch.batch_id ||
            batch.id ||
            "Unknown Batch"
          )}
        </h3>

        <p>
          <strong>Honey Type:</strong>
          ${escapeHTML(
            batch.honey_type || "Honey"
          )}
        </p>

        <p>
          <strong>Quantity:</strong>
          ${escapeHTML(
            batch.available_quantity ??
            batch.quantity ??
            "N/A"
          )} kg
        </p>

        <p>
          <strong>Region:</strong>
          ${escapeHTML(
            batch.region || "N/A"
          )}
        </p>

        <p>
          <strong>Location:</strong>
          ${escapeHTML(
            batch.location || "N/A"
          )}
        </p>

      </div>
    `).join("");

  } catch (error) {

    count.textContent = "";

    results.innerHTML = `
      <div class="card">

        <p>
          Unable to load marketplace data.
        </p>

        <p>
          ${escapeHTML(
            error.message || String(error)
          )}
        </p>

      </div>
    `;
  }
}

  form.addEventListener(
    "submit",
    function(event) {
      event.preventDefault();
      loadMarketplace();
    }
  );

  form.addEventListener(
    "reset",
    function() {
      setTimeout(loadMarketplace, 0);
    }
  );

  loadMarketplace();
}

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}