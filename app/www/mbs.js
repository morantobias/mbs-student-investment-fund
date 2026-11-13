/* MBS SIF workstation helpers.
 *  - navigation lock while a (single-threaded) data load is in flight
 *  - Enter in the ticker box triggers a load
 *  - clock in the navbar
 */
(function () {
  function registerHandlers() {
    if (!window.Shiny || !Shiny.addCustomMessageHandler) return;
    Shiny.addCustomMessageHandler("mbs-busy", function (busy) {
      document.body.classList.toggle("mbs-busy", !!busy);
    });
    Shiny.addCustomMessageHandler("mbs-scroll-top", function (msg) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    Shiny.addCustomMessageHandler("mbs-nav", function (page) {
      document.querySelectorAll(".mbs-nav-item").forEach(function (e) {
        e.classList.toggle("active", e.getAttribute("data-page") === page);
      });
    });
  }
  // Shiny's own scripts load before mbs.js, so register immediately when
  // possible; otherwise wait for the connection event.
  if (window.Shiny && window.Shiny.addCustomMessageHandler) {
    registerHandlers();
  } else {
    document.addEventListener("shiny:connected", registerHandlers);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var el = document.activeElement;
    if (el && el.closest && el.closest("#company + .selectize-control")) {
      var btn = document.getElementById("go");
      if (btn) setTimeout(function () { btn.click(); }, 120);
    }
  });
})();
