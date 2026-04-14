import { restoreState, syncDerivedFields, applyFormState } from "./state.js";
import { bindEvents, pingHealth } from "./actions.js";
import { renderAll } from "./render.js";

function init() {
  restoreState();
  syncDerivedFields(false);
  applyFormState();
  bindEvents();
  renderAll();
  pingHealth({ silent: true });
  window.setInterval(() => pingHealth({ silent: true }), 45000);
}

window.addEventListener("DOMContentLoaded", init);
