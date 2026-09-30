import { api, unwrap } from "./api.js";
import { $, onPage } from "./app.js";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function initFarmers() {
  const page = $("#page-farmers");

  if (!page) return;

  page.innerHTML = `
    <div class="card">

      <div class="card-header">
        <div>
          <h2>Farmer Management</h2>
          <p class="muted">
            Register unlimited farmers across India.
          </p>
        </div>

        <button
          id="farmer-refresh"
          class="button ghost"
          type="button"
        >
          Refresh
        </button>
      </div>

      <div
        id="farmer-message"
        style="margin-top:15px;"
      ></div>

      <form id="farmer-form" style="margin-top:20px;">

        <div class="form-grid">

          <label>
            Farmer Name
            <input
              type="text"
              name="name"
              placeholder="Enter farmer name"
              required
            >
          </label>

          <label>
            Age
            <input
              type="number"
              name="age"
              min="1"
              max="120"
              placeholder="Enter age"
              required
            >
          </label>

          <label>
            Phone
            <input
              type="tel"
              name="phone"
              placeholder="Enter phone number"
              required
            >
          </label>

          <label>
            State / Region
            <select
              name="region"
              id="farmer-region"
              required
            >
              <option value="">
                -- Select State / UT --
              </option>

              ${
                INDIAN_STATES.map(
                  state => `
                    <option value="${escapeHTML(state)}">
                      ${escapeHTML(state)}
                    </option>
                  `
                ).join("")
              }
            </select>
          </label>

          <label>
            District
            <input
              type="text"
              name="district"
              placeholder="Enter district"
              required
            >
          </label>

          <label>
            Village
            <input
              type="text"
              name="village"
              placeholder="Enter village"
              required
            >
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              placeholder="Set a password for login"
              minlength="6"
              required
            >
          </label>

        </div>

        <div class="actions" style="margin-top:20px;">

          <button
            type="submit"
            class="button"
            id="create-farmer-button"
          >
            Add Farmer
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

    <div
      class="card"
      style="margin-top:20px;"
    >

      <div class="card-header">
        <div>
          <h2>Registered Farmers</h2>
          <p
            id="farmer-count"
            class="muted"
          >
            Loading...
          </p>
        </div>
      </div>

      <div
        id="farmers-table"
        style="
          margin-top:15px;
          overflow-x:auto;
        "
      >
        <p class="muted">
          Loading farmers...
        </p>
      </div>

    </div>
  `;

  const form = $("#farmer-form");
  const table = $("#farmers-table");
  const message = $("#farmer-message");
  const count = $("#farmer-count");
  const refresh = $("#farmer-refresh");
  const submitButton = $("#create-farmer-button");

  async function loadFarmers() {
    table.innerHTML = `
      <p class="muted">
        Loading farmers...
      </p>
    `;

    try {
      const response = await api.get("/api/farmers");
      const data = unwrap(response);

      const farmers = Array.isArray(data)
        ? data
        : Array.isArray(data?.farmers)
          ? data.farmers
          : [];

      count.textContent =
        `${farmers.length} farmer${farmers.length === 1 ? "" : "s"} registered`;

      if (farmers.length === 0) {
        table.innerHTML = `
          <div class="card">
            <p>No farmers registered yet.</p>
          </div>
        `;
        return;
      }

      table.innerHTML = `
        <table
          style="
            width:100%;
            border-collapse:collapse;
          "
        >

          <thead>
            <tr>

              <th style="text-align:left;padding:12px;border-bottom:2px solid #eaded4;">
                # ID
              </th>

              <th style="text-align:left;padding:12px;border-bottom:2px solid #eaded4;">
                Farmer
              </th>

              <th style="text-align:center;padding:12px;border-bottom:2px solid #eaded4;">
                Age
              </th>

              <th style="text-align:left;padding:12px;border-bottom:2px solid #eaded4;">
                Phone
              </th>

              <th style="text-align:left;padding:12px;border-bottom:2px solid #eaded4;">
                State
              </th>

              <th style="text-align:left;padding:12px;border-bottom:2px solid #eaded4;">
                District
              </th>

              <th style="text-align:left;padding:12px;border-bottom:2px solid #eaded4;">
                Village
              </th>

            </tr>
          </thead>

          <tbody>

            ${
              farmers.map(
                farmer => `
                  <tr>

                    <td style="padding:12px;border-bottom:1px solid #eaded4;">
                      <strong>${escapeHTML(farmer.id)}</strong>
                    </td>

                    <td style="padding:12px;border-bottom:1px solid #eaded4;">
                      <strong>
                        ${escapeHTML(farmer.name)}
                      </strong>
                    </td>

                    <td style="padding:12px;text-align:center;border-bottom:1px solid #eaded4;">
                      ${escapeHTML(farmer.age)}
                    </td>

                    <td style="padding:12px;border-bottom:1px solid #eaded4;">
                      ${escapeHTML(farmer.phone)}
                    </td>

                    <td style="padding:12px;border-bottom:1px solid #eaded4;">
                      ${escapeHTML(farmer.region)}
                    </td>

                    <td style="padding:12px;border-bottom:1px solid #eaded4;">
                      ${escapeHTML(farmer.district)}
                    </td>

                    <td style="padding:12px;border-bottom:1px solid #eaded4;">
                      ${escapeHTML(farmer.village)}
                    </td>

                  </tr>
                `
              ).join("")
            }

          </tbody>

        </table>
      `;

    } catch (error) {
      table.innerHTML = `
        <div class="card">
          <p>Unable to load farmers.</p>
          <p class="muted">
            ${escapeHTML(error.message)}
          </p>
        </div>
      `;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    message.innerHTML = "";
    submitButton.disabled = true;
    submitButton.textContent = "Adding Farmer...";

    const formData = new FormData(form);

    const payload = {
      name: formData.get("name"),
      age: Number(formData.get("age")),
      phone: formData.get("phone"),
      region: formData.get("region"),
      district: formData.get("district"),
      village: formData.get("village"),
      password: formData.get("password")
    };

    try {
      await api.post("/api/farmers", payload);

      message.innerHTML = `
        <div
          style="
            padding:12px;
            border-radius:8px;
            background:#e8f5e9;
            color:#206348;
          "
        >
          Farmer added successfully! Please check the table below for the new Farmer ID, and use it to log in.
        </div>
      `;

      form.reset();
      await loadFarmers();

    } catch (error) {

      message.innerHTML = `
        <div
          style="
            padding:12px;
            border-radius:8px;
            background:#fce8e6;
            color:#a13232;
          "
        >
          Failed to add farmer:
          ${escapeHTML(error.message)}
        </div>
      `;

    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Add Farmer";
    }
  });

  refresh.addEventListener(
    "click",
    loadFarmers
  );

  onPage(
    "farmers",
    loadFarmers
  );

  loadFarmers();
}