#!/usr/bin/env python3
"""MBS Student Investment Fund — Investment Recommendation (Word template).

Builds a Financials-sector research-note template as a .docx from a JSON
payload produced by the Shiny app (R/word_note.R). The structure mirrors the
Fund's reference report (e.g. "Westpac - Sell S1 2026.docx"):

    Cover -> Table of Contents -> Notes -> Glossary
    -> Portfolio Recommendation -> Investment Thesis -> Investment Case
    -> Risks to the Recommendation -> Model Summary -> Scenario Analysis
    -> Valuation Summary and Recommendation -> Appendix (A/B/C)
    -> References & Sources

Colour code:
  * grey italics  -> the placeholder the analyst replaces
  * blue text     -> example guidance: what to discuss and why

Usage:
    python3 build_note.py <payload.json> <output.docx>
"""

import json
import sys

from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# MBS brand palette (mirrors app/R/brand.R and build_mbs_docx.py)
PRIMARY = RGBColor(0xA3, 0x00, 0x46)
DARK = RGBColor(0x5E, 0x00, 0x28)
TINT = RGBColor(0xF2, 0xE3, 0xEA)
GREY = RGBColor(0x59, 0x59, 0x59)
BLACK = RGBColor(0x21, 0x21, 0x21)
BLUE = RGBColor(0x2A, 0x78, 0xD6)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

BODY_FONT = "Calibri"
MARGIN = Cm(1.9)


def set_run_font(run, size=11, bold=False, italic=False, color=BLACK, name=BODY_FONT):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)
    rfonts.set(qn("w:cs"), name)


def shade_cell(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)


def add_heading(doc, text, level=1):
    """Word heading style (feeds the table of contents) in MBS colours."""
    h = doc.add_heading("", level=level)
    run = h.add_run(text)
    sizes = {1: 15, 2: 12.5, 3: 11.5}
    colours = {1: PRIMARY, 2: DARK, 3: BLACK}
    set_run_font(run, size=sizes.get(level, 11.5), bold=True, color=colours.get(level, BLACK))
    if level == 1:
        p_pr = h._p.get_or_add_pPr()
        pbdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "12")
        bottom.set(qn("w:space"), "3")
        bottom.set(qn("w:color"), "A30046")
        pbdr.append(bottom)
        p_pr.append(pbdr)
    return h


def add_para(doc, text, size=11, bold=False, italic=False, color=BLACK, space_after=6):
    p = doc.add_paragraph()
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold, italic=italic, color=color)
    p.paragraph_format.space_after = Pt(space_after)
    return p


def add_placeholder(doc, text):
    """The text the analyst must replace — grey italics, bracketed."""
    return add_para(doc, text, size=10.5, italic=True, color=GREY)


def add_guidance(doc, text):
    """Example + what to discuss and why — blue, to read as a hint."""
    return add_para(doc, text, size=10.5, italic=True, color=BLUE)


def add_table(doc, rows):
    """rows: list of dicts (first dict's keys are the headers)."""
    if not rows:
        return
    headers = list(rows[0].keys())
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, header in enumerate(headers):
        cell = table.rows[0].cells[j]
        cell.text = ""
        run = cell.paragraphs[0].add_run(str(header))
        set_run_font(run, size=9.5, bold=True, color=WHITE)
        shade_cell(cell, "A30046")
    for i, row in enumerate(rows):
        for j, header in enumerate(headers):
            cell = table.rows[i + 1].cells[j]
            cell.text = ""
            value = row.get(header, "")
            run = cell.paragraphs[0].add_run("" if value is None else str(value))
            set_run_font(run, size=9.5, bold=(j == 0), color=BLACK)
            if i % 2 == 1:
                shade_cell(cell, "FAF3F6")
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_toc_field(doc):
    """Real Word table-of-contents field — the user updates it with F9."""
    p = doc.add_paragraph()
    run = p.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = 'TOC \\o "1-3" \\h \\z \\u'
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Right-click and choose “Update Field” to build the table of contents."
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_sep)
    run._r.append(placeholder)
    run._r.append(fld_end)
    set_run_font(run, size=10, italic=True, color=GREY)


GLOSSARY = [
    ("AAE", "Active Australian Equities"),
    ("AIEA", "Average interest-earning assets"),
    ("APRA", "Australian Prudential Regulation Authority"),
    ("ASX", "Australian Securities Exchange"),
    ("CAPM", "Capital Asset Pricing Model"),
    ("CET1", "Common Equity Tier 1 (capital ratio)"),
    ("CoE / Ke", "Cost of equity"),
    ("CoR", "Combined ratio (insurers)"),
    ("DPS", "Dividend per share"),
    ("EPS", "Earnings per share"),
    ("FC", "Franking credits"),
    ("GWP", "Gross written premium (insurers)"),
    ("MoS", "Margin of safety"),
    ("NIM", "Net interest margin"),
    ("NII", "Net interest income"),
    ("NPAT", "Net profit after tax"),
    ("ROE", "Return on equity"),
    ("SIF", "Student Investment Fund"),
    ("WACC", "Weighted average cost of capital"),
]


def family_plan(family):
    """Financials-sector section plan keyed to the company's model family."""
    if family == "bank":
        return {
            "case": [
                ("Case driver 1 — Net interest margin & revenue",
                 "Discuss the NIM outlook, loan and deposit volumes, non-interest income and the mix of the book. State the driver, the direction and the earnings consequence.",
                 "e.g. “Mortgage competition compresses NIM 8bp to 1.85% by FY28, cutting NII growth to 2% despite 5% lending growth.”"),
                ("Case driver 2 — Credit quality",
                 "Discuss the credit cycle: impairment / bad-and-doubtful-debt charges, arrears, the loan-book mix (housing vs business) and provisioning buffers.",
                 "e.g. “BDD charges normalise from 8bp toward 15bp of gross loans as arrears lift, reducing NPAT by ~4%.”"),
                ("Case driver 3 — Costs & capital",
                 "Discuss cost-to-income, any transformation program (e.g. UNITE), CET1 capital, RWA intensity and the capacity for buybacks or dividends.",
                 "e.g. “UNITE delivers $400m of annualised cost-out but slips 12 months; CET1 rebuilds to 12.3% enabling a 5% buyback.”"),
            ],
            "risks": [
                ("Risk 1 — Sustained investor demand",
                 "Describe what would make the market keep paying up: yield-seeking flows, superannuation inflows, defensive rotation.",
                 "e.g. “Compulsory super directs ~9% of flows into large-cap banks, supporting the multiple despite weaker earnings.”"),
                ("Risk 2 — Successful cost transformation",
                 "Describe what happens if the transformation delivers on time and under budget, lifting the efficiency ratio.",
                 "e.g. “UNITE delivers ahead of plan; cost-to-income falls to 47% and ROE re-rates toward 14%.”"),
                ("Risk 3 — Macroeconomic tailwinds",
                 "Describe the rates / housing / labour-market scenario that would support earnings and asset quality.",
                 "e.g. “Rate cuts and a soft landing keep arrears below 1% and revive credit growth to 6%.”"),
            ],
            "model": [
                ("Net Revenue", "Describe the NII + non-interest income build: volumes, margins, fees."),
                ("Average Interest-Earning Assets", "Describe the AIEA build across housing, business and personal lending."),
                ("Net Interest Margin", "Describe the NIM path and the broker-consensus anchor."),
                ("Operating Costs", "Describe the cost base, inflation and transformation cost-out."),
                ("Impairments", "Describe the impairment charge as bp of lending assets and the cycle assumption."),
            ],
        }
    if family == "insurer":
        return {
            "case": [
                ("Case driver 1 — Premium growth & rate",
                 "Discuss gross written premium (GWP) growth, rate adequacy, retention and volume.",
                 "e.g. “GWP grows 8% on home and motor rate increases while retention holds at 85%.”"),
                ("Case driver 2 — Underwriting margin",
                 "Discuss the combined ratio, loss ratio, expense ratio, nat-perils allowances and reserve releases.",
                 "e.g. “The combined ratio improves to 92% as perils allowances normalise and pricing runs ahead of claims inflation.”"),
                ("Case driver 3 — Investment income & capital",
                 "Discuss investment income on the float, the capital position and dividend policy.",
                 "e.g. “Investment income rises 12% as bond yields stay elevated; the PCA headroom funds a special dividend.”"),
            ],
            "risks": [
                ("Risk 1 — Natural-perils losses",
                 "Describe catastrophe loss scenarios, reinsurance attachment and earnings volatility.",
                 "e.g. “A La Niña event lifts nat-perils losses above the reinsurance attachment point, adding 4pts to the combined ratio.”"),
                ("Risk 2 — Premium rate cycle turns",
                 "Describe what happens if competition forces rates down and the margin compresses.",
                 "e.g. “A soft market cuts GWP growth to 2% and the combined ratio back above 98%.”"),
                ("Risk 3 — Reserve deterioration",
                 "Describe the reserve-risk scenario: adverse development, inflation in claims costs.",
                 "e.g. “Long-tail reserve strengthening of $120m reduces NPAT by 8%.”"),
            ],
            "model": [
                ("Gross Written Premium", "Describe the GWP build by line of business and rate/volume split."),
                ("Combined Ratio", "Describe the loss and expense ratio path and nat-perils allowance."),
                ("Investment Income", "Describe the portfolio yield, duration and floating income."),
                ("Reserving", "Describe reserve adequacy, releases/strengthening and the claims cycle."),
            ],
        }
    return {
        "case": [
            ("Case driver 1 — Funds under management & flows",
             "Discuss FUM/AUM, net flows, performance fees and platform/administration revenue.",
             "e.g. “FUM grows 10% on inflows and markets; performance fees normalise off the FY26 high.”"),
            ("Case driver 2 — Markets & advisory revenue",
             "Discuss markets, M&A / advisory and trading revenue and their cyclicality.",
             "e.g. “Markets revenue normalises 15% as volatility subsides, a partial offset to annuity growth.”"),
            ("Case driver 3 — Fees & competition",
             "Discuss fee pressure, product mix, and the cost base supporting the franchise.",
             "e.g. “Platform fee compression of 5bp pa trims annuity margins, only partly offset by cost discipline.”"),
        ],
        "risks": [
            ("Risk 1 — Market & flow cyclicality",
             "Describe the drawdown / outflows scenario and its revenue impact.",
             "e.g. “A 20% equity drawdown cuts FUM-linked revenue 12% and stalls net flows.”"),
            ("Risk 2 — Regulatory fee reform",
             "Describe ASIC / government fee or design-and-distribution changes.",
             "e.g. “Further fee reform compresses platform margins by 5bp, shaving ROE ~1.5pts.”"),
            ("Risk 3 — Key-person & operational risk",
             "Describe succession, technology and conduct risks.",
             "e.g. “Loss of the CIO or a data breach damages the franchise and raises redemptions.”"),
        ],
        "model": [
            ("Funds Under Management", "Describe the FUM build: flows, markets, performance."),
            ("Fee Revenue", "Describe the fee rate by product and the mix shift."),
            ("Markets Revenue", "Describe the markets / advisory run-rate and cycle assumption."),
            ("Costs", "Describe the cost base and operating leverage."),
        ],
    }


def recommendation_verb(rec):
    return {
        "Buy": "Initiated",
        "Hold": "Held",
        "Sell": "Sold",
    }.get(rec, "Reviewed")


def build_doc(payload, out_path):
    doc = Document()
    for section in doc.sections:
        section.top_margin = MARGIN
        section.bottom_margin = MARGIN
        section.left_margin = MARGIN
        section.right_margin = MARGIN

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(11)
    normal.font.color.rgb = BLACK

    family = payload.get("family", "financial")
    plan = family_plan(family)
    rec = payload.get("rec", "n/a")
    name = payload.get("name", "")
    code = payload.get("code", "")

    # ---- Cover ----
    add_para(doc, "Melbourne Business School", size=14, bold=True, color=DARK, space_after=0)
    add_para(doc, "Student Investment Fund", size=14, bold=True, color=DARK, space_after=18)
    add_para(doc, "Investment Recommendation", size=24, bold=True, color=PRIMARY, space_after=6)
    add_para(doc, name, size=16, bold=True, color=BLACK, space_after=4)
    add_para(doc, "ASX code: " + code, size=11, color=GREY, space_after=18)
    add_placeholder(doc, "« Analyst name (Senior Analyst – Active Australian Equities) »")
    add_placeholder(doc, "« Analyst name (Analyst – Active Australian Equities) »")
    add_para(doc, "Creation date: " + payload.get("loaded_at", "") +
             "  |  Version date: " + payload.get("generated", ""),
             size=10, color=GREY, space_after=0)
    doc.add_page_break()

    # ---- Table of contents ----
    add_heading(doc, "Table of Contents", 1)
    add_toc_field(doc)
    doc.add_page_break()

    # ---- Notes ----
    add_heading(doc, "Notes", 1)
    add_para(doc, "This report is made available for the sole purpose of demonstrating the analysis "
                  "undertaken by students enrolled in the Melbourne Business School Student Investment Fund. "
                  "It does not constitute financial product advice. Data: Yahoo Finance via yahoofinancer, "
                  "not warranted as accurate or complete.", size=10, italic=True, color=GREY)

    # ---- Glossary ----
    add_heading(doc, "Glossary", 1)
    add_table(doc, [{"Term": k, "Definition": v} for k, v in GLOSSARY])

    # ---- Portfolio recommendation ----
    add_heading(doc, "Portfolio Recommendation", 1)
    add_para(doc, payload.get("recommendation_text", ""))
    if payload.get("key"):
        add_table(doc, payload["key"])

    # ---- Investment thesis ----
    add_heading(doc, "Investment Thesis", 1)
    add_heading(doc, "Original Investment Thesis", 2)
    add_placeholder(doc, "« Replace with the original investment thesis and its key drivers. »")
    add_guidance(doc, "State the drivers of long-term value that originally underpinned the position — "
                      "asset/book quality, dividend yield and franking, market structure and pricing power, "
                      "management and franchise strength — and whether each has materialised.")

    add_heading(doc, "Why the Position Should Be " + recommendation_verb(rec), 2)
    add_placeholder(doc, "« Replace with the case for the recommendation. »")
    add_guidance(doc, plan["case"][0][1])
    add_guidance(doc, plan["case"][0][2])

    add_heading(doc, "Model Evolution", 2)
    add_placeholder(doc, "« Replace with how the model changed versus the prior iteration and why. »")
    add_guidance(doc, "Summarise the material changes to drivers and assumptions versus the prior model, "
                      "and the direction and size of the valuation impact.")

    # ---- Investment case ----
    add_heading(doc, "Investment Case", 1)
    for title, guidance, example in plan["case"]:
        add_heading(doc, title, 2)
        add_heading(doc, "Evidence & Drivers", 3)
        add_placeholder(doc, "« Replace with the evidence and drivers for this case. »")
        add_guidance(doc, guidance)
        add_guidance(doc, example)
        add_heading(doc, "Implications for Valuation", 3)
        add_placeholder(doc, "« Replace with the valuation consequence of this driver. »")

    # ---- Risks ----
    add_heading(doc, "Risks to the " + rec + " Recommendation", 1)
    for title, guidance, example in plan["risks"]:
        add_heading(doc, title, 2)
        add_placeholder(doc, "« Replace with the risk, its trigger and consequence. »")
        add_guidance(doc, guidance)
        add_guidance(doc, example)

    # ---- Model summary ----
    add_heading(doc, "Model Summary", 1)
    add_para(doc, payload.get("model_text", ""))
    for title, guidance in plan["model"]:
        add_heading(doc, title, 2)
        add_placeholder(doc, "« Replace with the " + title.lower() + " build and assumptions. »")
        add_guidance(doc, guidance)
    if payload.get("proj"):
        add_heading(doc, "Forecast Drivers", 2)
        add_table(doc, payload["proj"])

    # ---- Scenarios ----
    add_heading(doc, "Scenario Analysis", 1)
    add_para(doc, "Bear, base and bull cases apply growth, margin/payout, cost-of-equity and "
                  "terminal-growth deltas to the base-case drivers; weights reflect the analysts' "
                  "probability assessment.")
    if payload.get("scen"):
        add_table(doc, payload["scen"])

    # ---- Valuation summary ----
    add_heading(doc, "Valuation Summary and Recommendation", 1)
    add_para(doc, payload.get("methodology", ""))
    if payload.get("methods"):
        add_table(doc, payload["methods"])
    add_para(doc, payload.get("valuation_text", ""))

    # ---- Appendix ----
    add_heading(doc, "Appendix", 1)
    add_heading(doc, "Appendix A: Key Financial Summary", 2)
    if payload.get("fin"):
        add_table(doc, payload["fin"])
    add_heading(doc, "Appendix B: Scenario Analysis", 2)
    if payload.get("scen"):
        add_table(doc, payload["scen"])
    add_heading(doc, "Appendix C: Sensitivity Analysis", 2)
    add_heading(doc, "Cost of equity (Ke)", 3)
    if payload.get("sens_ke"):
        add_table(doc, payload["sens_ke"])
    add_heading(doc, "Growth", 3)
    if payload.get("sens_growth"):
        add_table(doc, payload["sens_growth"])

    # ---- References ----
    add_heading(doc, "References & Sources", 1)
    add_para(doc, payload.get("references", ""))
    add_para(doc, "Melbourne Business School · 200 Leicester Street, Carlton VIC 3053 · "
                  "CRICOS Provider No. 00116K · www.mbs.edu", size=9, color=GREY)

    # ---- Footer ----
    footer = doc.sections[0].footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("MBS Student Investment Fund · Equity Research Workstation · " +
                    payload.get("version", ""))
    set_run_font(run, size=8, color=GREY)

    doc.save(out_path)


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: build_note.py <payload.json> <output.docx>")
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    build_doc(payload, sys.argv[2])


if __name__ == "__main__":
    main()
