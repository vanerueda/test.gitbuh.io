<script>
// Immediately-Invoked Function Expression (IIFE) to avoid global namespace pollution.
(function() {
  // Create a container div
  var container = document.createElement("div");
  container.style.textAlign = "center";
  container.style.fontFamily = "sans-serif";
  container.style.margin = "20px";
  document.body.appendChild(container);

  // Create a title
  var title = document.createElement("h1");
  title.innerText = "Passive Balancing Simulation";
  container.appendChild(title);

  // Create the canvas element
  var canvas = document.createElement("canvas");
  canvas.id = "passiveCanvas";
  canvas.width = 600;
  canvas.height = 500;
  canvas.style.border = "1px solid #333";
  canvas.style.background = "#fff";
  container.appendChild(canvas);

  // Create the reset button
  var resetButton = document.createElement("button");
  resetButton.id = "resetButton";
  resetButton.innerText = "Reset Simulation";
  resetButton.style.marginTop = "10px";
  resetButton.style.fontSize = "16px";
  resetButton.style.padding = "8px 16px";
  resetButton.style.cursor = "pointer";
  container.appendChild(resetButton);

  // -------------------------------
  // Global Constants and Parameters
  // -------------------------------
  var V_MIN = 3.0;          // Minimum (empty) cell voltage [V]
  var V_MAX = 4.2;          // Full–charge open–circuit voltage [V]
  var OVP   = 4.2;          // Over–voltage protection threshold [V]
  var I_BASE = 0.005;       // Base charging current (arbitrary units)
  var dPassive = 0.001;     // Passive balancing decrement (SOC units per step)
  var tolVoltage = 0.005;   // Voltage tolerance for determining balance

  // -------------------------------
  // Simulation State Variables
  // -------------------------------
  var phase, chargingActive, simulationRunning;
  var cells = [];
  var ctx = canvas.getContext("2d");

  // -------------------------------
  // Initialize the Battery Cells
  // -------------------------------
  function initCells() {
    // Three series–connected cells:
    //   • Cell 1: Capacity = 3.0 Ah, initial SOC = 70%, internal resistance = 0.05 Ω
    //   • Cell 2: Capacity = 2.5 Ah, initial SOC = 50%, internal resistance = 0.08 Ω
    //   • Cell 3: Capacity = 3.5 Ah, initial SOC = 90%, internal resistance = 0.03 Ω
    cells = [
      { capacity: 3.0, SOC: 0.70, R: 0.05 },
      { capacity: 2.5, SOC: 0.50, R: 0.08 },
      { capacity: 3.5, SOC: 0.90, R: 0.03 }
    ];
  }

  // -------------------------------
  // Helper Functions
  // -------------------------------
  // Compute the open–circuit voltage (OCV) assuming a linear relation with SOC.
  function getOCV(cell) {
    return V_MIN + (V_MAX - V_MIN) * cell.SOC;
  }

  // Compute the measured cell voltage (OCV plus the IR drop when charging).
  function getMeasuredVoltage(cell, current) {
    // When charging, add the IR drop; when not, current is zero.
    return getOCV(cell) + (chargingActive ? current * cell.R : 0);
  }

  // -------------------------------
  // Drawing the Battery Cells
  // -------------------------------
  function drawCells() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Display header information.
    ctx.fillStyle = "black";
    ctx.font = "16px Arial";
    ctx.fillText("Passive Balancing after Charge", 20, 30);
    ctx.fillText("Phase: " + phase, 20, 50);

    // Layout parameters.
    var margin = 100;
    var cellWidth = 80;
    var cellHeight = 300;
    var gap = (canvas.width - 2 * margin - cells.length * cellWidth) / (cells.length - 1);

    // Draw each cell.
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var x = margin + i * (cellWidth + gap);
      var y = canvas.height - margin - cellHeight;

      // Draw the cell outline.
      ctx.strokeStyle = "black";
      ctx.strokeRect(x, y, cellWidth, cellHeight);

      // Compute the fill height (green fill) based on SOC (capped at 100%).
      var socDisplay = Math.min(cell.SOC, 1);
      var fillHeight = cellHeight * socDisplay;
      var fillY = y + cellHeight - fillHeight;
      ctx.fillStyle = "green";
      ctx.fillRect(x, fillY, cellWidth, fillHeight);

      // Determine effective current for voltage calculation.
      var effectiveCurrent = chargingActive ? I_BASE : 0;
      var voltage = getMeasuredVoltage(cell, effectiveCurrent).toFixed(2);

      // Display cell information.
      ctx.fillStyle = "black";
      ctx.font = "14px Arial";
      ctx.fillText("Cell " + (i + 1), x + 5, y - 30);
      ctx.fillText("SOC: " + (cell.SOC * 100).toFixed(1) + "%", x + 5, y - 10);
      ctx.fillText("V: " + voltage + "V", x + 5, y + cellHeight + 20);
    }
  }

  // -------------------------------
  // Simulation Update Logic
  // -------------------------------
  function updateSimulation() {
    // --- Charging Phase ---
    if (phase === "charging") {
      // Increase each cell's SOC based on the constant current.
      // (Smaller–capacity cells gain more per step.)
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        cell.SOC += I_BASE / cell.capacity;
        if (cell.SOC > 1) { cell.SOC = 1; }
      }
      // Check if any cell's measured voltage reaches or exceeds the OVP.
      var overvoltage = cells.some(function(cell) {
        return getMeasuredVoltage(cell, I_BASE) >= OVP;
      });
      if (overvoltage) {
        chargingActive = false;  // Disable charging.
        phase = "balancing";       // Switch to passive balancing.
      }
    }
    // --- Balancing Phase (Passive Balancing) ---
    else if (phase === "balancing") {
      // Determine the minimum measured voltage (with no charging current).
      var measuredVoltages = cells.map(function(cell) {
        return getMeasuredVoltage(cell, 0);
      });
      var minVoltage = Math.min.apply(null, measuredVoltages);
      // For any cell that is above the minimum (by more than tolVoltage), reduce its SOC.
      for (var i = 0; i < cells.length; i++) {
        if (measuredVoltages[i] > minVoltage + tolVoltage) {
          cells[i].SOC -= dPassive;
          if (cells[i].SOC < 0) { cells[i].SOC = 0; }
        }
      }
      // Check if balancing is complete (all voltages nearly equal).
      measuredVoltages = cells.map(function(cell) {
        return getMeasuredVoltage(cell, 0);
      });
      if (Math.max.apply(null, measuredVoltages) - Math.min.apply(null, measuredVoltages) < tolVoltage) {
        phase = "done";
      }
    }
  }

  // -------------------------------
  // Animation Loop
  // -------------------------------
  function animate() {
    if (!simulationRunning) return;
    updateSimulation();
    drawCells();
    if (phase !== "done") {
      requestAnimationFrame(animate);
    } else {
      ctx.fillStyle = "blue";
      ctx.font = "24px Arial";
      ctx.fillText("Simulation Done", 200, 80);
      simulationRunning = false;
    }
  }

  // -------------------------------
  // Reset and Start Simulation
  // -------------------------------
  function resetSimulation() {
    initCells();
    phase = "charging";
    chargingActive = true;
    simulationRunning = true;
    animate();
  }

  // Attach the reset button click event.
  resetButton.addEventListener("click", resetSimulation);

  // Start the simulation immediately.
  resetSimulation();
})();
</script>
