# --- Downloads tab ------------------------------------------------------------------
export_pkg <- reactive({
  b <- bd(); req(b)
  # The analyst-note fields were removed from the UI but the workbooks still
  # reference them; supply empty defaults so exports stay valid.
  notes <- list(analysts = "", thesis = "", case = "", risks = "", catalysts = "", esg = "")
  list(bd = b, peers = peers_rv(), a = assumptions(), v = valuation(), scen = scenarios(),
       sens = list(ke = sens_ke(), growth = sens_g(), tg = sens_tg(), margin = sens_m(), grid = sens2d()),
       ff = football(), sector = sector_rv(), headline = headline(), notes = notes, generated = Sys.time())
})

stamp <- function() format(Sys.Date(), "%Y%m%d")

output$dl_company <- downloadHandler(
  filename = function() paste0(bd()$code, "_MBS_SIF_Research_", stamp(), ".xlsx"),
  content = function(file) withProgress(message = "Building research workbook…", value = 0.4, export_company_workbook(export_pkg(), file)))
output$dl_model <- downloadHandler(
  filename = function() paste0(bd()$code, "_Junior_Analyst_Model_", stamp(), ".xlsx"),
  content = function(file) withProgress(message = "Building financial model…", value = 0.4, export_financial_model(export_pkg(), file)))
output$dl_ratio <- downloadHandler(
  filename = function() paste0(bd()$code, "_Ratio_Guide_", stamp(), ".xlsx"),
  content = function(file) withProgress(message = "Building ratio guide…", value = 0.4, export_ratio_guide(export_pkg(), file)))
output$dl_sector <- downloadHandler(
  filename = function() paste0("MBS_SIF_Sector_", gsub("[^A-Za-z0-9]", "_", sector_rv()$name %||% "universe"), "_", stamp(), ".xlsx"),
  content = function(file) {
    s <- sector_rv()
    if (is.null(s)) { showNotification("Load a sector on the Sector & Screener tab first.", type = "warning"); s <- list(name = "No sector loaded", table = peers_tbl()) }
    withProgress(message = "Building sector workbook…", value = 0.4, export_sector_workbook(s, file, subject = bd()$code))
  })
output$dl_note <- downloadHandler(
  filename = function() paste0(bd()$code, "_Investment_Recommendation_", stamp(), ".docx"),
  content = function(file) withProgress(message = "Building Word research note…", value = 0.4,
    tryCatch(research_note_docx(export_pkg(), file),
             error = function(e) { showNotification(paste("Word note failed:", conditionMessage(e)), type = "error", duration = 12); stop(e) })))
output$dl_bundle <- downloadHandler(
  filename = function() paste0(bd()$code, "_MBS_SIF_Bundle_", stamp(), ".zip"),
  content = function(file) withProgress(message = "Building bundle…", value = 0.3, export_bundle(export_pkg(), file)))
