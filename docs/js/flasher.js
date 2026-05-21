/* Piglet Web Flasher — uses esptool-js v0.6.0 directly (ESP32-C5 USB fix) */

let _esptool = null;

async function getEsptool() {
  if (_esptool) return _esptool;
  _esptool = await import(
    "https://esm.sh/esptool-js@0.6.0"
  );
  return _esptool;
}

/* ---------- UI helpers ---------- */
const $ = (id) => document.getElementById(id);

function showOverlay() {
  $("flash-overlay").hidden = false;
  $("flash-close").hidden = true;
  $("flash-log").textContent = "";
  $("flash-bar").style.width = "0%";
  $("flash-pct").textContent = "";
  $("flash-status").textContent = "Initializing\u2026";
}

function hideOverlay() {
  $("flash-overlay").hidden = true;
}

function setStatus(msg) {
  $("flash-status").textContent = msg;
}

function setProgress(pct) {
  $("flash-bar").style.width = pct + "%";
  $("flash-pct").textContent = pct + "%";
}

function log(msg) {
  const el = $("flash-log");
  el.textContent += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

/* ---------- Flash logic ---------- */
window.flashDevice = async function (manifestPath) {
  if (!("serial" in navigator)) {
    alert("Web Serial is not supported in this browser. Use Chrome, Edge, or Opera.");
    return;
  }

  showOverlay();

  try {
    /* 1. Select serial port FIRST (needs user gesture) */
    setStatus("Select your serial port\u2026");
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch (_e) {
      setStatus("No port selected.");
      $("flash-close").hidden = false;
      return;
    }

    /* 2. Load esptool-js */
    setStatus("Loading flasher\u2026");
    const { ESPLoader, Transport } = await getEsptool();

    /* 3. Fetch manifest */
    setStatus("Fetching firmware info\u2026");
    const mResp = await fetch(manifestPath);
    if (!mResp.ok) throw new Error("Manifest not found (" + mResp.status + ")");
    const manifest = await mResp.json();
    const build = manifest.builds[0];
    const part = build.parts[0];
    log("Firmware: " + manifest.name);
    log("Target:   " + build.chipFamily);

    /* 4. Download firmware binary */
    setStatus("Downloading firmware\u2026");
    const base = manifestPath.substring(0, manifestPath.lastIndexOf("/") + 1);
    const fwUrl = part.path.startsWith("http") ? part.path : base + part.path;
    const fwResp = await fetch(fwUrl);
    if (!fwResp.ok)
      throw new Error("Firmware download failed (" + fwResp.status + ")");
    const fwData = new Uint8Array(await fwResp.arrayBuffer());
    log("Size:     " + (fwData.length / 1024).toFixed(0) + " KB");

    /* 5. Connect */
    setStatus("Connecting to device\u2026");
    const transport = new Transport(port, true);
    const terminal = {
      clean() {},
      writeLine(data) {
        log(data);
      },
      write(_data) {
        /* skip partial writes to keep log clean */
      },
    };
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal,
    });
    const chip = await loader.main();
    log("Connected: " + chip);

    /* 6. Verify chip family */
    const normalize = (s) => s.replace(/[-_ ]/g, "").toUpperCase();
    if (normalize(chip) !== normalize(build.chipFamily)) {
      throw new Error(
        "Wrong chip! Expected " +
          build.chipFamily +
          " but found " +
          chip +
          "."
      );
    }

    /* 7. Flash */
    setStatus("Erasing flash\u2026");
    await loader.writeFlash({
      fileArray: [{ data: fwData, address: part.offset }],
      eraseAll: false,
      compress: true,
      reportProgress(_fileIndex, written, total) {
        const pct = Math.round((written / total) * 100);
        setProgress(pct);
        setStatus("Flashing\u2026 " + pct + "%");
      },
    });

    /* 8. Hard reset */
    setStatus("Resetting device\u2026");
    await loader.after("hard_reset");
    await transport.disconnect();

    setProgress(100);
    setStatus("\u2705 Flash complete! Device is restarting.");
    log("\nDone! Your Piglet is ready.");
  } catch (err) {
    console.error(err);
    setStatus("\u274c " + err.message);
    log("\nERROR: " + err.message);
  }

  $("flash-close").hidden = false;
};

/* Close overlay */
document.addEventListener("DOMContentLoaded", () => {
  const btn = $("flash-close");
  if (btn) btn.addEventListener("click", hideOverlay);
});
