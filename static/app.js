/**
 * OLDSMAR SCADA CHEMICAL DOSING SAFETY INTERLOCK
 * Tailwind CSS + Flowbite Charts (ApexCharts) Integration
 * Default: Clean White Background (Light Theme) with Dark Mode Support
 */

// Global Flowbite / ApexCharts Instances
let phChart = null;
let sensorChart = null;
let doseChart = null;

// Telemetry State Tracking for Deltas
let previousTelemetry = {
  flow: null,
  feed: null,
  resulting: null,
  ph: null,
  dose: null
};

// Processed Events Set & Timers
const seenEventIds = new Set();
let blockDecayTimeout = null;

// Audit Trail State
let allAuditDecisions = [];
let currentAuditFilter = "ALL";
let currentAuditSearch = "";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initCharts();
  bindSidebarTabs();
  bindUIEvents();
  bindAttackStudio();
  bindAuditControls();
  startTelemetryPolling();
  loadAuditTrail();
});

/**
 * Theme Management (Default: Clean White Background)
 */
function initTheme() {
  const savedTheme = localStorage.getItem("scada_theme") || "light";
  applyTheme(savedTheme);

  const themeBtn = document.getElementById("btn-theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.classList.contains("dark");
      const nextTheme = isDark ? "light" : "dark";
      applyTheme(nextTheme);
      localStorage.setItem("scada_theme", nextTheme);
      updateChartTheme(nextTheme);
    });
  }
}

function applyTheme(theme) {
  const icon = document.getElementById("theme-icon");
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    if (icon) icon.setAttribute("data-lucide", "sun");
  } else {
    document.documentElement.classList.remove("dark");
    if (icon) icon.setAttribute("data-lucide", "moon");
  }
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function updateChartTheme(theme) {
  if (!phChart || !sensorChart || !doseChart) return;
  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const themeMode = isDark ? "dark" : "light";

  [phChart, sensorChart, doseChart].forEach((chart) => {
    chart.updateOptions(
      {
        theme: { mode: themeMode },
        grid: { borderColor: gridColor },
        tooltip: { theme: themeMode }
      },
      false,
      false
    );
  });
}

/**
 * Flowbite Charts (ApexCharts) Initialization
 * Configured per Flowbite Charts guidelines: https://flowbite.com/docs/plugins/charts/
 */
function initCharts() {
  if (typeof ApexCharts === "undefined") {
    console.error("ApexCharts library not loaded.");
    return;
  }

  const isDark = document.documentElement.classList.contains("dark");
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

  // 1. Finished Water pH Chart (Flowbite Area Chart with Safe & Hazard Annotations)
  const phContainer = document.getElementById("ph-chart-container");
  if (phContainer) {
    const phOptions = {
      chart: {
        height: "100%",
        type: "area",
        fontFamily: "'Inter', sans-serif",
        dropShadow: { enabled: false },
        toolbar: { show: false },
        animations: { enabled: false }
      },
      tooltip: {
        enabled: true,
        theme: isDark ? "dark" : "light",
        x: { show: true },
        y: {
          formatter: (val) => `${val !== undefined && val !== null ? val.toFixed(2) : "--"} pH`
        }
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        }
      },
      dataLabels: { enabled: false },
      stroke: {
        width: 2.5,
        curve: "smooth"
      },
      grid: {
        show: true,
        strokeDashArray: 4,
        borderColor: gridColor,
        padding: { left: 10, right: 10, top: -10, bottom: 0 }
      },
      colors: ["#0284c7"],
      series: [
        {
          name: "Finished Water pH",
          data: []
        }
      ],
      xaxis: {
        categories: [],
        tickAmount: 8,
        labels: {
          show: true,
          rotate: 0,
          hideOverlappingLabels: true,
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            cssClass: "text-[10px] font-medium fill-gray-500 dark:fill-gray-400"
          }
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false }
      },
      yaxis: {
        min: 6.0,
        max: 13.5,
        tickAmount: 5,
        labels: {
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            cssClass: "text-[10px] font-medium fill-gray-500 dark:fill-gray-400"
          },
          formatter: (val) => (val !== undefined && val !== null ? val.toFixed(1) : "")
        }
      },
      annotations: {
        yaxis: [
          {
            y: 8.5,
            borderColor: "#d97706",
            strokeDashArray: 4,
            borderWidth: 1.5,
            label: {
              borderColor: "#d97706",
              style: {
                color: "#ffffff",
                background: "#d97706",
                fontSize: "9px",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600
              },
              text: "Safe Ceiling (8.5 pH)"
            }
          },
          {
            y: 10.0,
            borderColor: "#ef4444",
            strokeDashArray: 4,
            borderWidth: 1.5,
            label: {
              borderColor: "#ef4444",
              style: {
                color: "#ffffff",
                background: "#ef4444",
                fontSize: "9px",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600
              },
              text: "Hazard Threshold (10.0 pH)"
            }
          }
        ]
      }
    };
    phChart = new ApexCharts(phContainer, phOptions);
    phChart.render();
  }

  // 2. Dual Sensor Channels Chart (Flowbite Multi-Series Line Chart)
  const sensorContainer = document.getElementById("sensor-chart-container");
  if (sensorContainer) {
    const sensorOptions = {
      chart: {
        height: "100%",
        type: "line",
        fontFamily: "'Inter', sans-serif",
        dropShadow: { enabled: false },
        toolbar: { show: false },
        animations: { enabled: false }
      },
      tooltip: {
        enabled: true,
        theme: isDark ? "dark" : "light",
        x: { show: true },
        y: {
          formatter: (val) => `${val !== undefined && val !== null ? val.toFixed(1) : "--"} ppm`
        }
      },
      dataLabels: { enabled: false },
      stroke: {
        width: [2, 2],
        curve: "smooth"
      },
      colors: ["#ef4444", "#10b981"],
      series: [
        {
          name: "Primary Sensor (Attack Surface)",
          data: []
        },
        {
          name: "Independent Verification Channel",
          data: []
        }
      ],
      xaxis: {
        categories: [],
        tickAmount: 4,
        labels: {
          show: true,
          rotate: 0,
          hideOverlappingLabels: true,
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            cssClass: "text-[10px] font-medium fill-gray-500 dark:fill-gray-400"
          }
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false }
      },
      yaxis: {
        min: 0,
        max: 12000,
        tickAmount: 4,
        labels: {
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            cssClass: "text-[10px] font-medium fill-gray-500 dark:fill-gray-400"
          },
          formatter: (val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val.toFixed(0)}`)
        }
      },
      grid: {
        show: true,
        strokeDashArray: 4,
        borderColor: gridColor,
        padding: { left: 10, right: 10, top: -10, bottom: 0 }
      },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "right",
        fontSize: "10px",
        fontFamily: "'Inter', sans-serif",
        labels: {
          colors: isDark ? "#9ca3af" : "#6b7280"
        },
        markers: { radius: 2 }
      }
    };
    sensorChart = new ApexCharts(sensorContainer, sensorOptions);
    sensorChart.render();
  }

  // 3. Pump Actuator Dose Chart (Flowbite Line Chart - Requested vs Actual Ghost Line)
  const doseContainer = document.getElementById("dose-chart-container");
  if (doseContainer) {
    const doseOptions = {
      chart: {
        height: "100%",
        type: "line",
        fontFamily: "'Inter', sans-serif",
        dropShadow: { enabled: false },
        toolbar: { show: false },
        animations: { enabled: false }
      },
      tooltip: {
        enabled: true,
        theme: isDark ? "dark" : "light",
        x: { show: true },
        y: {
          formatter: (val) => `${val !== undefined && val !== null ? val.toFixed(1) : "--"} ppm`
        }
      },
      dataLabels: { enabled: false },
      stroke: {
        width: [1.8, 2.5],
        curve: "smooth",
        dashArray: [5, 0]
      },
      colors: ["#ef4444", "#0284c7"],
      series: [
        {
          name: "Requested Dose (SCADA Command)",
          data: []
        },
        {
          name: "Actual Actuator Dose",
          data: []
        }
      ],
      xaxis: {
        categories: [],
        tickAmount: 4,
        labels: {
          show: true,
          rotate: 0,
          hideOverlappingLabels: true,
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            cssClass: "text-[10px] font-medium fill-gray-500 dark:fill-gray-400"
          }
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false }
      },
      yaxis: {
        min: 0,
        max: 12000,
        tickAmount: 4,
        labels: {
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            cssClass: "text-[10px] font-medium fill-gray-500 dark:fill-gray-400"
          },
          formatter: (val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val.toFixed(0)}`)
        }
      },
      grid: {
        show: true,
        strokeDashArray: 4,
        borderColor: gridColor,
        padding: { left: 10, right: 10, top: -10, bottom: 0 }
      },
      legend: {
        show: false
      },
      annotations: {
        yaxis: [
          {
            y: 150,
            borderColor: "#d97706",
            strokeDashArray: 4,
            borderWidth: 1.5,
            label: {
              borderColor: "#d97706",
              style: {
                color: "#ffffff",
                background: "#d97706",
                fontSize: "9px",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600
              },
              text: "SIS Hard Ceiling (150 ppm)"
            }
          }
        ]
      }
    };
    doseChart = new ApexCharts(doseContainer, doseOptions);
    doseChart.render();
  }
}

/**
 * Sidebar Tab Switching
 */
function switchTab(tabKey) {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((n) => {
    if (n.dataset.tab === tabKey) n.classList.add("active");
    else n.classList.remove("active");
  });

  document.querySelectorAll(".view-page").forEach((page) => {
    page.classList.add("hidden");
    page.classList.remove("active");
  });
  const targetPage = document.getElementById(`view-${tabKey}`);
  if (targetPage) {
    targetPage.classList.remove("hidden");
    targetPage.classList.add("active");
  }

  if (tabKey === "audit-trail") {
    loadAuditTrail();
  }

  // Trigger resize so Flowbite / ApexCharts recomputes sizes if tab was hidden
  if (tabKey === "overview") {
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function bindSidebarTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tabKey = item.dataset.tab;
      window.location.hash = tabKey;
      switchTab(tabKey);
    });
  });

  const initialHash = window.location.hash.replace("#", "");
  if (initialHash && document.getElementById(`view-${initialHash}`)) {
    switchTab(initialHash);
  }
}

/**
 * General UI Bindings
 */
function bindUIEvents() {
  const toggle = document.getElementById("interlock-toggle");
  if (toggle) {
    toggle.addEventListener("change", async (e) => {
      const isEnabled = e.target.checked;
      await fetch("/interlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: isEnabled })
      });
      updateInterlockBadge(isEnabled);
    });
  }

  const resetAction = async () => {
    await fetch("/reset", { method: "POST" });
    if (toggle) {
      toggle.checked = true;
    }
    updateInterlockBadge(true);
    seenEventIds.clear();
    const eventLog = document.getElementById("event-log");
    if (eventLog) eventLog.innerHTML = "";
    document.querySelectorAll(".attack-scenario-card").forEach((c) => c.classList.remove("active-exploit"));
    resetCustomSliders();
    resetPipelineSchematic();
  };

  const btnReset = document.getElementById("btn-reset-top");
  if (btnReset) {
    btnReset.addEventListener("click", resetAction);
  }

  const btnRefreshAudit = document.getElementById("btn-refresh-audit");
  if (btnRefreshAudit) {
    btnRefreshAudit.addEventListener("click", loadAuditTrail);
  }
}

/**
 * Cyberattack Simulation Studio Bindings
 */
function bindAttackStudio() {
  // Scenario launch buttons
  document.querySelectorAll(".launch-exploit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const variant = btn.dataset.variant;
      document.querySelectorAll(".attack-scenario-card").forEach((c) => c.classList.remove("active-exploit"));
      const parentCard = btn.closest(".attack-scenario-card");
      if (parentCard) parentCard.classList.add("active-exploit");

      await fetch(`/attack/${variant}`, { method: "POST" });
    });
  });

  // Custom Exploit Sliders
  const primaryRange = document.getElementById("custom-primary-range");
  const primaryLabel = document.getElementById("slider-primary-val");
  if (primaryRange && primaryLabel) {
    primaryRange.addEventListener("input", (e) => {
      primaryLabel.textContent = `${parseFloat(e.target.value).toFixed(1)} ppm`;
    });
  }

  const flowRange = document.getElementById("custom-flow-range");
  const flowLabel = document.getElementById("slider-flow-val");
  if (flowRange && flowLabel) {
    flowRange.addEventListener("input", (e) => {
      flowLabel.textContent = `${parseFloat(e.target.value).toFixed(1)} L/s`;
    });
  }

  // Quick presets
  document.querySelectorAll(".quick-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = parseFloat(btn.dataset.val);
      if (primaryRange) primaryRange.value = val;
      if (primaryLabel) primaryLabel.textContent = `${val.toFixed(1)} ppm`;
    });
  });

  // Fire custom injection
  const btnFire = document.getElementById("btn-fire-custom");
  if (btnFire) {
    btnFire.addEventListener("click", async () => {
      const pVal = parseFloat(primaryRange.value);
      const fVal = parseFloat(flowRange.value);

      await fetch("/sensors/primary/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: pVal })
      });

      if (Math.abs(fVal - 50.0) > 1.0) {
        await fetch("/sensors/flow/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: fVal })
        });
      }
    });
  }

  // Stop all attacks
  const btnStop = document.getElementById("btn-stop-all");
  if (btnStop) {
    btnStop.addEventListener("click", async () => {
      await fetch("/attack/stop", { method: "POST" });
      document.querySelectorAll(".attack-scenario-card").forEach((c) => c.classList.remove("active-exploit"));
      resetCustomSliders();
    });
  }
}

function resetCustomSliders() {
  const pRange = document.getElementById("custom-primary-range");
  const pLabel = document.getElementById("slider-primary-val");
  if (pRange) pRange.value = 100;
  if (pLabel) pLabel.textContent = "100.0 ppm";

  const fRange = document.getElementById("custom-flow-range");
  const fLabel = document.getElementById("slider-flow-val");
  if (fRange) fRange.value = 50;
  if (fLabel) fLabel.textContent = "50.0 L/s";
}

/**
 * Real-Time Telemetry Polling (500ms)
 */
function startTelemetryPolling() {
  const poll = async () => {
    try {
      const res = await fetch("/state");
      if (!res.ok) return;
      const state = await res.json();
      renderState(state);
    } catch (err) {
      console.warn("Dropped telemetry tick:", err);
    }
  };
  poll();
  setInterval(poll, 500);
}

/**
 * Main State Render Cycle
 */
function renderState(state) {
  // 1. Header Telemetry
  const runIdEl = document.getElementById("run-id-text");
  if (runIdEl) runIdEl.textContent = state.run_id ? state.run_id.slice(-6) : "INIT";

  const uptimeEl = document.getElementById("uptime-text");
  if (uptimeEl) uptimeEl.textContent = `${state.uptime_seconds.toFixed(1)}s`;

  // Sync SIS Key Switch toggle
  const toggle = document.getElementById("interlock-toggle");
  if (toggle && toggle.checked !== state.interlock_on) {
    toggle.checked = state.interlock_on;
  }
  updateInterlockBadge(state.interlock_on);

  // Status Pill
  updateStatusPill(state);

  // 2. Stat Cards
  const sensors = state.sensors;
  const control = state.control;

  updateStat("stat-flow", "stat-flow-delta", sensors.flow_l_s, previousTelemetry.flow, "L/s");
  updateStat("stat-feed", "stat-feed-delta", control.feed_rate_mg_s, previousTelemetry.feed, "mg/s", 0);
  updateStat("stat-resulting", "stat-resulting-delta", control.resulting_ppm, previousTelemetry.resulting, "ppm");
  updateStat("stat-dose", "stat-dose-delta", control.actual_dose_ppm, previousTelemetry.dose, "ppm");

  // pH readout
  const phEl = document.getElementById("stat-ph");
  if (phEl) {
    phEl.textContent = control.ph.toFixed(2);
    phEl.className = `stat-value text-2xl font-bold tracking-tight ph-${control.ph_band}`;
  }

  const phBadge = document.getElementById("ph-band-badge");
  if (phBadge) {
    phBadge.textContent = `${control.ph_band.toUpperCase()} BAND`;
    phBadge.className =
      control.ph_band === "safe"
        ? "text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
        : control.ph_band === "elevated"
        ? "text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
        : "text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-200 text-red-700 dark:border-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40";
  }

  updateDelta("stat-ph-delta", control.ph, previousTelemetry.ph, "pH");

  // Ghost divergence badge
  const ghostBadge = document.getElementById("ghost-divergence-badge");
  if (ghostBadge) {
    const doseDiff = Math.abs(control.requested_dose_ppm - control.actual_dose_ppm);
    if (doseDiff > 50.0) {
      ghostBadge.textContent = `DIVERGENCE: +${doseDiff.toFixed(0)} PPM`;
      ghostBadge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
    } else {
      ghostBadge.textContent = "ALIGNED";
      ghostBadge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
    }
  }

  // Sensor Channel Divergence Badge
  const denom = Math.max(sensors.verification_ppm, 1.0);
  const divPct = (Math.abs(sensors.primary_ppm - sensors.verification_ppm) / denom) * 100;
  const divBadge = document.getElementById("divergence-badge");
  if (divBadge) {
    divBadge.textContent = `DIV: ${divPct.toFixed(1)}%`;
    divBadge.className =
      divPct > 15.0
        ? "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
        : "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
  }

  // Cache for deltas
  previousTelemetry = {
    flow: sensors.flow_l_s,
    feed: control.feed_rate_mg_s,
    resulting: control.resulting_ppm,
    ph: control.ph,
    dose: control.actual_dose_ppm
  };

  // 3. Update Flowbite ApexCharts Telemetry Curves
  const history = state.history;
  const labels = history.time_labels || [];

  if (phChart) {
    phChart.updateSeries([{ name: "Finished Water pH", data: history.ph }], false);
    phChart.updateOptions({ xaxis: { categories: labels, tickAmount: 8 } }, false, false);
  }

  if (sensorChart) {
    sensorChart.updateSeries(
      [
        { name: "Primary Sensor (Attack Surface)", data: history.primary },
        { name: "Independent Verification Channel", data: history.verification }
      ],
      false
    );
    sensorChart.updateOptions({ xaxis: { categories: labels, tickAmount: 4 } }, false, false);
  }

  if (doseChart) {
    doseChart.updateSeries(
      [
        { name: "Requested Dose (SCADA Command)", data: history.requested_dose },
        { name: "Actual Actuator Dose", data: history.actual_dose }
      ],
      false
    );
    doseChart.updateOptions({ xaxis: { categories: labels, tickAmount: 4 } }, false, false);
  }

  // 4. Update Cyber-Physical Pipeline & Defense Schematic
  updatePipelineSchematic(state);

  // 5. Update Exploit Stepper & Gate Statuses
  updateStepperAndGates(state);

  // 6. Update Event Log
  renderEvents(state.events || []);
}

/**
 * Real-Time Cyber-Physical Schematic Animation
 */
function updatePipelineSchematic(state) {
  const sensors = state.sensors;
  const control = state.control;
  const isBlocked = state.system_status === "BLOCKED";
  const isDanger = state.system_status === "DANGER";
  const isAttacking = state.active_attack !== null || sensors.primary_injected || sensors.flow_injected;

  const pSvg = document.getElementById("svg-text-primary");
  if (pSvg) pSvg.textContent = `P: ${sensors.primary_ppm.toFixed(0)} ppm`;

  const vSvg = document.getElementById("svg-text-verif");
  if (vSvg) vSvg.textContent = `V: ${sensors.verification_ppm.toFixed(0)} ppm`;

  const reqSvg = document.getElementById("svg-req-dose");
  if (reqSvg) reqSvg.textContent = `Req: ${control.requested_dose_ppm.toFixed(0)} ppm`;

  const actSvg = document.getElementById("svg-act-dose");
  if (actSvg) actSvg.textContent = `Act: ${control.actual_dose_ppm.toFixed(0)} ppm`;

  const tankSvg = document.getElementById("svg-tank-ph");
  if (tankSvg) tankSvg.textContent = `${control.ph.toFixed(2)} pH`;

  const attackBeam = document.getElementById("svg-attack-beam");
  const attackLabel = document.getElementById("svg-attack-label");
  const nodeSensor = document.getElementById("svg-node-sensor");
  if (isAttacking) {
    if (attackBeam) attackBeam.setAttribute("opacity", "1");
    if (attackLabel) attackLabel.setAttribute("opacity", "1");
    if (nodeSensor) nodeSensor.setAttribute("stroke", "#ef4444");
  } else {
    if (attackBeam) attackBeam.setAttribute("opacity", "0");
    if (attackLabel) attackLabel.setAttribute("opacity", "0");
    if (nodeSensor) nodeSensor.setAttribute("stroke", "#0284c7");
  }

  const shield = document.getElementById("svg-sis-shield");
  const shieldText = document.getElementById("svg-shield-text");
  const pipelineBadge = document.getElementById("pipeline-status-badge");

  if (shield && shieldText && pipelineBadge) {
    if (!state.interlock_on) {
      shield.setAttribute("filter", "");
      shield.querySelector("circle").setAttribute("stroke", "#71717a");
      shield.querySelector("circle").setAttribute("stroke-dasharray", "4 4");
      shield.querySelector("path").setAttribute("fill", "#71717a");
      shieldText.textContent = "SIS BYPASSED";
      shieldText.setAttribute("fill", "#71717a");
      pipelineBadge.textContent = "SAFETY BYPASSED";
      pipelineBadge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
    } else if (isBlocked) {
      shield.setAttribute("filter", "url(#glowRed)");
      shield.querySelector("circle").setAttribute("stroke", "#ef4444");
      shield.querySelector("circle").setAttribute("stroke-dasharray", "");
      shield.querySelector("path").setAttribute("fill", "#ef4444");
      shieldText.textContent = "SHIELD: DEFLECTED";
      shieldText.setAttribute("fill", "#ef4444");
      pipelineBadge.textContent = "DOSE BLOCKED BY SIS";
      pipelineBadge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
    } else {
      shield.setAttribute("filter", "url(#glowGreen)");
      shield.querySelector("circle").setAttribute("stroke", "#10b981");
      shield.querySelector("circle").setAttribute("stroke-dasharray", "");
      shield.querySelector("path").setAttribute("fill", "#10b981");
      shieldText.textContent = "SIS INTERLOCK";
      shieldText.setAttribute("fill", "#10b981");
      pipelineBadge.textContent = "SHIELD ACTIVE";
      pipelineBadge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
    }
  }

  const pumpNode = document.getElementById("svg-node-pump");
  const tankNode = document.getElementById("svg-node-tank");

  if (pumpNode && tankNode && tankSvg) {
    if (isDanger) {
      pumpNode.setAttribute("stroke", "#ef4444");
      tankNode.setAttribute("stroke", "#ef4444");
      tankSvg.setAttribute("fill", "#ef4444");
    } else if (control.ph_band === "elevated") {
      pumpNode.setAttribute("stroke", "#d97706");
      tankNode.setAttribute("stroke", "#d97706");
      tankSvg.setAttribute("fill", "#d97706");
    } else {
      pumpNode.setAttribute("stroke", "#0284c7");
      tankNode.setAttribute("stroke", "#10b981");
      tankSvg.setAttribute("fill", "#10b981");
    }
  }
}

function resetPipelineSchematic() {
  const attackBeam = document.getElementById("svg-attack-beam");
  if (attackBeam) attackBeam.setAttribute("opacity", "0");
  const attackLabel = document.getElementById("svg-attack-label");
  if (attackLabel) attackLabel.setAttribute("opacity", "0");
  const nodeSensor = document.getElementById("svg-node-sensor");
  if (nodeSensor) nodeSensor.setAttribute("stroke", "#0284c7");
}

/**
 * Update Exploit Stage Stepper & Safety Gate Status Cards
 */
function updateStepperAndGates(state) {
  const isAttacking = state.active_attack !== null || state.sensors.primary_injected;
  const isBlocked = state.system_status === "BLOCKED";
  const isDanger = state.system_status === "DANGER";

  const step1 = document.getElementById("step-phase-1");
  const step2 = document.getElementById("step-phase-2");
  const step3 = document.getElementById("step-phase-3");
  const step4 = document.getElementById("step-phase-4");

  if (step1 && step2 && step3 && step4) {
    if (isAttacking) {
      step1.classList.add("active");
      step2.classList.add("active");
      if (state.interlock_on && isBlocked) {
        step3.classList.add("active");
        step4.classList.remove("active");
      } else if (!state.interlock_on && isDanger) {
        step3.classList.remove("active");
        step4.classList.add("active");
      }
    } else {
      step1.classList.remove("active");
      step2.classList.remove("active");
      step3.classList.remove("active");
      step4.classList.remove("active");
    }
  }

  // Safety Gate Badges
  const g1 = document.getElementById("gate1-status");
  const g2 = document.getElementById("gate2-status");
  const g3 = document.getElementById("gate3-status");

  const lastReason = state.last_decision ? state.last_decision.reason : "";
  if (g1) {
    if (isBlocked && lastReason.includes("HARD_BOUND_EXCEEDED")) {
      g1.textContent = "TRIPPED";
      g1.className = "gate-badge badge-destructive";
    } else {
      g1.textContent = "MONITORING";
      g1.className = "gate-badge badge-outline";
    }
  }

  if (g2) {
    if (isBlocked && lastReason.includes("RATE_OF_CHANGE_EXCEEDED")) {
      g2.textContent = "TRIPPED";
      g2.className = "gate-badge badge-destructive";
    } else {
      g2.textContent = "MONITORING";
      g2.className = "gate-badge badge-outline";
    }
  }

  if (g3) {
    if (isBlocked && lastReason.includes("SENSOR_DISAGREEMENT")) {
      g3.textContent = "TRIPPED";
      g3.className = "gate-badge badge-destructive";
    } else {
      g3.textContent = "MONITORING";
      g3.className = "gate-badge badge-outline";
    }
  }
}

/**
 * Status Pill & Sustained 3s Block Glow
 */
function updateStatusPill(state) {
  const pill = document.getElementById("status-pill");
  const text = document.getElementById("status-text");
  const sideStatus = document.getElementById("sidebar-status-text");

  if (!pill || !text) return;

  if (state.system_status === "DANGER") {
    pill.className = "status-pill tripped";
    text.textContent = `CRITICAL DANGER: pH ${state.control.ph.toFixed(2)}`;
    if (sideStatus) {
      sideStatus.textContent = "HAZARD TRIP";
      sideStatus.className = "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
    }
    triggerBlockGlow();
  } else if (state.system_status === "BLOCKED") {
    pill.className = "status-pill tripped";
    const gateName = state.last_decision ? state.last_decision.reason.split(":")[0] : "DOSE BLOCKED";
    text.textContent = `BLOCKED: ${gateName}`;
    if (sideStatus) {
      sideStatus.textContent = "DOSE BLOCKED";
      sideStatus.className = "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
    }
    triggerBlockGlow();
  } else {
    pill.className = "status-pill nominal";
    text.textContent = "NOMINAL OPERATION";
    if (sideStatus) {
      sideStatus.textContent = "OPTIMAL";
      sideStatus.className = "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300";
    }
  }
}

function triggerBlockGlow() {
  document.body.classList.add("block-active");
  if (blockDecayTimeout) clearTimeout(blockDecayTimeout);
  blockDecayTimeout = setTimeout(() => {
    document.body.classList.remove("block-active");
  }, 3000);
}

function updateInterlockBadge(isEnabled) {
  const badge = document.getElementById("interlock-badge");
  if (!badge) return;
  if (isEnabled) {
    badge.textContent = "ENGAGED";
    badge.className = "ml-1 text-[9px] font-semibold px-1.5 py-0.2 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
  } else {
    badge.textContent = "BYPASSED";
    badge.className = "ml-1 text-[9px] font-semibold px-1.5 py-0.2 rounded-full border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
  }
}

function updateStat(valId, deltaId, current, previous, unit, decimals = 1) {
  const valEl = document.getElementById(valId);
  if (valEl && current !== undefined && current !== null) {
    valEl.textContent = current.toFixed(decimals);
  }
  updateDelta(deltaId, current, previous, unit, decimals);
}

function updateDelta(elemId, current, previous, unit, decimals = 1) {
  const el = document.getElementById(elemId);
  if (!el) return;
  if (previous === null || previous === undefined || current === undefined || current === null) {
    el.textContent = "--";
    el.className = "mono text-gray-400 dark:text-gray-500";
    return;
  }
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) {
    el.textContent = "■ 0.0";
    el.className = "mono text-gray-400 dark:text-gray-500";
  } else if (diff > 0) {
    el.textContent = `▲ +${diff.toFixed(decimals)}`;
    el.className = "mono font-semibold text-red-600 dark:text-red-400";
  } else {
    el.textContent = `▼ ${diff.toFixed(decimals)}`;
    el.className = "mono font-semibold text-sky-600 dark:text-sky-400";
  }
}

/**
 * Event Log Rendering
 */
function renderEvents(events) {
  const container = document.getElementById("event-log");
  const countBadge = document.getElementById("event-count-badge");
  if (countBadge) countBadge.textContent = `${events.length} EVENTS`;
  if (!container) return;

  events.forEach((ev) => {
    if (seenEventIds.has(ev.id)) return;
    seenEventIds.add(ev.id);

    const item = document.createElement("div");
    const itemType = ev.type.toLowerCase();
    item.className = `event-entry ${itemType}`;

    let badgeClass = "badge-secondary";
    if (ev.type === "BLOCKED") badgeClass = "badge-destructive";
    else if (ev.type === "ALLOWED") badgeClass = "badge-outline";
    else if (ev.type === "ATTACK") badgeClass = "badge-warning";

    item.innerHTML = `
      <div class="event-entry-top">
        <span class="badge ${badgeClass}">${ev.type}</span>
        <span class="event-time mono">${ev.time_str}</span>
      </div>
      <div class="event-msg"><b>${escapeHtml(ev.message)}</b></div>
      <div class="text-[10px] text-gray-500 dark:text-gray-400">${escapeHtml(ev.detail)}</div>
    `;

    container.insertBefore(item, container.firstChild);
  });
}

/**
 * SQLite Audit Trail Controls & Table Rendering
 */
function bindAuditControls() {
  const filterBtns = document.querySelectorAll(".audit-filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentAuditFilter = btn.dataset.filter;
      renderAuditTable();
    });
  });

  const searchInput = document.getElementById("audit-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentAuditSearch = e.target.value.trim().toLowerCase();
      renderAuditTable();
    });
  }
}

async function loadAuditTrail() {
  const tbody = document.getElementById("audit-table-body");
  if (!tbody) return;

  try {
    const runsRes = await fetch("/runs");
    const runs = await runsRes.json();
    if (!runs || !runs.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center p-8 text-gray-400 dark:text-gray-500">No audit records found in SQLite sink.</td></tr>`;
      return;
    }

    const latestRun = runs[0].run_id;
    const decRes = await fetch(`/runs/${latestRun}/decisions?limit=100`);
    const decData = await decRes.json();
    allAuditDecisions = decData.decisions || [];

    renderAuditTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-red-500 p-8">Failed to load audit records: ${err}</td></tr>`;
  }
}

function renderAuditTable() {
  const tbody = document.getElementById("audit-table-body");
  const countBadge = document.getElementById("audit-records-count");
  if (!tbody) return;

  let filtered = allAuditDecisions;

  // 1. Decision Filter (ALL, BLOCKED, ALLOWED)
  if (currentAuditFilter !== "ALL") {
    filtered = filtered.filter((r) => r.decision === currentAuditFilter);
  }

  // 2. Search Term Filter
  if (currentAuditSearch) {
    filtered = filtered.filter((r) => {
      const haystack = `${r.iso_time} ${r.run_id} ${r.decision} ${r.reason} ${r.primary_ppm} ${r.actual_dose}`.toLowerCase();
      return haystack.includes(currentAuditSearch);
    });
  }

  if (countBadge) {
    countBadge.textContent = `${filtered.length} RECORDS`;
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center p-8 text-gray-400 dark:text-gray-500">No matching audit records.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .slice(-50)
    .reverse()
    .map(
      (r) => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-750 transition">
      <td class="px-3 py-2 font-mono text-gray-500 dark:text-gray-400">${r.iso_time.split(" ")[1] || r.iso_time}</td>
      <td class="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">${r.run_id.slice(-6)}</td>
      <td class="px-3 py-2">
        <span class="badge ${r.decision === "BLOCKED" ? "badge-destructive" : "badge-outline"}">
          ${r.decision}
        </span>
      </td>
      <td class="px-3 py-2 font-mono font-bold text-red-600 dark:text-red-400">${r.requested_dose.toFixed(1)}</td>
      <td class="px-3 py-2 font-mono font-bold text-sky-600 dark:text-sky-400">${r.actual_dose.toFixed(1)}</td>
      <td class="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">${r.resulting_ppm.toFixed(1)}</td>
      <td class="px-3 py-2 font-mono font-bold ${r.ph > 10 ? "ph-danger" : r.ph > 8.5 ? "ph-elevated" : "ph-safe"}">${r.ph.toFixed(2)}</td>
      <td class="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">${r.primary_ppm.toFixed(1)}</td>
      <td class="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">${r.verification_ppm.toFixed(1)}</td>
      <td class="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">${r.flow.toFixed(1)}</td>
      <td class="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 max-w-[240px] truncate" title="${escapeHtml(r.reason)}">
        ${escapeHtml(r.reason)}
      </td>
    </tr>
  `
    )
    .join("");
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}
