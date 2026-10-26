"use strict";

(function () {
  var firmwareLabel = "14.00";
  var connectButton = document.getElementById("connect");
  var connectionCard = document.getElementById("connection-card");
  var sessionId = document.getElementById("session-id");
  var remoteStatus = document.getElementById("remote-status");
  var remoteLog = document.getElementById("remote-log");
  var session = null;
  var active = false;
  var polling = false;
  var logLines = [];

  function setRemoteStatus(message, state) {
    remoteStatus.textContent = message;
    connectionCard.className = "connection-card is-" + state;
  }

  function appendLog(message) {
    var lines = String(message).slice(0, 12000).split(/\r?\n/);
    for (var i = 0; i < lines.length; i += 1) logLines.push(lines[i]);
    if (logLines.length > 240) logLines.splice(0, logLines.length - 240);
    remoteLog.textContent = logLines.join("\n");
    remoteLog.scrollTop = remoteLog.scrollHeight;
  }

  function request(path, value, secret) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", path, true);
      xhr.timeout = 10000;
      xhr.setRequestHeader("Content-Type", "application/json");
      if (secret) xhr.setRequestHeader("X-FW14-Session", secret);
      xhr.onload = function () {
        var body;
        try { body = JSON.parse(xhr.responseText); }
        catch (error) { reject(new Error("Invalid server response")); return; }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          var failure = new Error(body.error || "Server rejected request");
          failure.httpStatus = xhr.status;
          reject(failure);
        }
      };
      xhr.onerror = function () { reject(new Error("Network error")); };
      xhr.ontimeout = function () { reject(new Error("Request timed out")); };
      xhr.send(JSON.stringify(value));
    });
  }

  function requestSync(path, value, secret) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", path, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (secret) xhr.setRequestHeader("X-FW14-Session", secret);
    xhr.send(JSON.stringify(value));
    if (xhr.status < 200 || xhr.status >= 300)
      throw new Error("Synchronous marker rejected (HTTP " + xhr.status + ")");
    try { return JSON.parse(xhr.responseText); }
    catch (error) { throw new Error("Invalid synchronous marker response"); }
  }

  function schedulePoll(delay) {
    if (active) setTimeout(poll, delay);
  }

  function validProbeChecks(checks, expected) {
    if (!Array.isArray(checks) || checks.length !== expected.length) return false;
    for (var i = 0; i < checks.length; i += 1) {
      var check = checks[i];
      if (!check || Object.prototype.toString.call(check) !== "[object Object]" ||
          Object.keys(check).sort().join(",") !== "details,id,status" ||
          check.id !== expected[i] ||
          ["pass", "fail", "unsupported", "error"].indexOf(check.status) === -1 ||
          !check.details || Object.prototype.toString.call(check.details) !== "[object Object]") {
        return false;
      }
      var keys = Object.keys(check.details);
      if (keys.length > 12) return false;
      for (var j = 0; j < keys.length; j += 1) {
        if (!/^[a-z][a-z0-9_-]{0,63}$/.test(keys[j])) return false;
        var item = check.details[keys[j]];
        if (item !== null && typeof item !== "string" && typeof item !== "number" &&
            typeof item !== "boolean") return false;
        if (typeof item === "string" && item.length > 512) return false;
        if (typeof item === "number" && !isFinite(item)) return false;
      }
    }
    try { return JSON.stringify(checks).length <= 3600; }
    catch (error) { return false; }
  }

  function fetchProbe(command) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "/api/commands/" + command.command_id + "/probe", true);
      xhr.timeout = 10000;
      xhr.setRequestHeader("X-FW14-Session", session.secret);
      xhr.setRequestHeader("X-FW14-Attempt", command.attempt_token);
      xhr.onload = function () {
        if (xhr.status !== 200) {
          reject(new Error("Probe fetch failed (HTTP " + xhr.status + ")"));
          return;
        }
        var actual;
        try { actual = window.FW14_SHA256.hex(xhr.responseText); }
        catch (error) { reject(new Error("Probe digest check failed: " + String(error))); return; }
        var served = xhr.getResponseHeader("X-FW14-Source-SHA256");
        if (actual !== command.source_sha256 || served !== command.source_sha256) {
          reject(new Error("Probe source digest mismatch"));
          return;
        }
        resolve(xhr.responseText);
      };
      xhr.onerror = function () { reject(new Error("Probe fetch network error")); };
      xhr.ontimeout = function () { reject(new Error("Probe fetch timed out")); };
      xhr.send();
    });
  }

  function runDynamicProbe(command) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        finish(new Error("Probe exceeded its time limit"));
      }, command.timeout_ms);
      function finish(error, checks) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(checks);
      }
      fetchProbe(command).then(function (source) {
        if (settled) return;
        var runner;
        try { runner = new Function("api", '"use strict";\n' + source); }
        catch (error) { finish(error); return; }
        var result;
        try {
          result = runner({
            probe_id: command.probe_id,
            isActive: function () { return !settled; },
            log: function (message) { appendLog(message); },
            mark: function (phase) {
              return request("/api/commands/mark", {
                session_id: session.id,
                command_id: command.command_id,
                attempt: command.attempt,
                attempt_token: command.attempt_token,
                phase: phase
              }, session.secret);
            },
            markSync: function (phase) {
              return requestSync("/api/commands/mark", {
                session_id: session.id,
                command_id: command.command_id,
                attempt: command.attempt,
                attempt_token: command.attempt_token,
                phase: phase
              }, session.secret);
            },
            uploadChunkSync: function (chunk) {
              var payload = {
                session_id: session.id,
                command_id: command.command_id,
                attempt_token: command.attempt_token,
                pid: chunk.pid,
                module_handle: chunk.module_handle,
                segment_kind: chunk.segment_kind,
                range_start: chunk.range_start,
                range_size: chunk.range_size,
                offset: chunk.offset,
                data_b64: chunk.data_b64
              };
              return requestSync("/api/dump/chunk", payload, session.secret);
            }
          });
        }
        catch (error) { finish(error); return; }
        Promise.resolve(result).then(function (checks) {
          if (!validProbeChecks(checks, command.check_ids)) {
            finish(new Error("Probe returned invalid checks"));
          } else {
            finish(null, checks);
          }
        }).catch(function (error) { finish(error); });
      }).catch(function (error) { finish(error); });
    });
  }

  function deliverResult(payload, command) {
    request("/api/commands/result", payload, session.secret).then(function () {
      var error = false;
      for (var i = 0; i < payload.checks.length; i += 1) {
        var check = payload.checks[i];
        if (check.status === "error") error = true;
      }
      if (command && command.probe_id ===
          "clone_history_inrange_anchor_groom_v6" &&
          payload.checks[0].status === "fail" &&
          payload.checks[0].details.batch === 4)
        appendLog("Address setup could not finish on this page.");
      else if (error) appendLog("Test error. See capture on PC.");
      setRemoteStatus("Connected", "connected");
      polling = false;
      schedulePoll(2000);
    }).catch(function (error) {
      setRemoteStatus("Saving result…", "connecting");
      if (error.httpStatus === 400 && payload.action === "run_probe_v1" &&
          payload.checks[0].id !== "probe_error") {
        payload.checks = [{ id: "probe_error", status: "error",
                            details: { error: "Server rejected probe output: " +
                              String(error).slice(0, 450) } }];
        deliverResult(payload, command);
        return;
      }
      if (error.httpStatus >= 400 && error.httpStatus < 500) {
        active = false;
        connectButton.disabled = false;
        connectButton.hidden = false;
        sessionId.textContent = "—";
        setRemoteStatus("Disconnected", "error");
        appendLog("result rejected: " + String(error));
        polling = false;
        return;
      }
      setTimeout(function () { deliverResult(payload); }, 3000);
    });
  }

  function runCommand(command) {
    if (command.probe_id === "clone_history_jsarray_storage_v1")
      appendLog("Preparing live memory readout...");
    else if (command.probe_id === "clone_history_native_invoke_install_v32")
      appendLog("Checking syscall interface...");
    else if (command.probe_id === "clone_history_getrlimit10_v1")
      appendLog("Reading memory limit...");
    setRemoteStatus("Running test…", "connecting");
    var started = new Date().toISOString();
    var operation = command.action === "run_probe_v1" ? runDynamicProbe(command) :
      window.FW14_PROBES.execute(command.action);
    operation.catch(function (error) {
      return [{ id: command.action === "run_probe_v1" ? "probe_error" : "command_error", status: "error",
                details: { error: String(error).slice(0, 512) } }];
    }).then(function (checks) {
      var completed = new Date().toISOString();
      deliverResult({
        session_id: session.id,
        command_id: command.command_id,
        action: command.action,
        attempt: command.attempt,
        attempt_token: command.attempt_token,
        started_at: started,
        completed_at: completed,
        client_time: completed,
        checks: checks
      }, command);
    });
  }

  function poll() {
    if (!active || polling) return;
    polling = true;
    request("/api/commands/claim", { session_id: session.id }, session.secret)
      .then(function (response) {
        if (response.command) {
          runCommand(response.command);
        } else {
          polling = false;
          schedulePoll(2000);
        }
      }).catch(function (error) {
        polling = false;
        setRemoteStatus("Reconnecting…", "connecting");
        schedulePoll(3000);
      });
  }

  function connectRemote() {
    if (active || connectButton.disabled) return;
    connectButton.disabled = true;
    connectButton.hidden = true;
    sessionId.textContent = "—";
    setRemoteStatus("Connecting…", "connecting");
    request("/api/sessions", {
      firmware_label: firmwareLabel,
      user_agent: navigator.userAgent || "unavailable",
      runner_version: 1
    }).then(function (identity) {
      session = { id: identity.session_id, secret: identity.session_secret };
      active = true;
      sessionId.textContent = session.id.slice(0, 8);
      setRemoteStatus("Connected", "connected");
      if (logLines.length === 0) remoteLog.textContent = "No output yet.";
      poll();
    }).catch(function (error) {
      connectButton.disabled = false;
      connectButton.hidden = false;
      setRemoteStatus("Disconnected", "error");
      appendLog("connection failed: " + String(error));
    });
  }

  connectButton.onclick = connectRemote;
  // Every fresh page starts its own remote session for the configured firmware.
  window.addEventListener("load", function () {
    setTimeout(connectRemote, 500);
  });
}());
