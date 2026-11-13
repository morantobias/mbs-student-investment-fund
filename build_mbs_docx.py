#!/usr/bin/env python3
"""Rebuild 'Financials - Westpac - Sell S1 2026' as a Melbourne Business School
Student Investment Fund Word document.

- Layout/content of the original report is preserved.
- Styling is rebranded to MBS: Calibri font, MBS magenta palette, MBS logo in
  the footer (bottom right) and on the cover.
- Fund name references are updated (ANU/SMF -> MBS/SIF).
"""

from docx import Document
from docx.shared import Pt, RGBColor, Mm, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn, nsmap
from docx.oxml import OxmlElement

# ---------------------------------------------------------------------------
# MBS brand palette (from MBS Investment Fund inaugural meeting deck)
# ---------------------------------------------------------------------------
PRIMARY = RGBColor(0xA3, 0x00, 0x46)   # MBS magenta
DARK    = RGBColor(0x5E, 0x00, 0x28)   # MBS dark maroon
TINT    = RGBColor(0xF2, 0xE3, 0xEA)   # light magenta tint (table shading)
GREY    = RGBColor(0x59, 0x59, 0x59)   # body/footer grey
BLACK   = RGBColor(0x21, 0x21, 0x21)   # near-black body text

BODY_FONT = "Calibri"

ASSETS = {
    "logo": "assets_mbs_logo_transparent.png",
    "price_chart": "assets_chart_price_history.png",
    "opex_chart": "assets_chart_opex.png",
}


def set_run_font(run, size=None, bold=None, italic=None, color=None, name=BODY_FONT):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color


def add_para(doc, text="", size=10, bold=False, italic=False, color=BLACK,
             align=None, space_before=0, space_after=4, style=None, name=BODY_FONT):
    p = doc.add_paragraph(style=style)
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.line_spacing = 1.0
    if text:
        r = p.add_run(text)
        set_run_font(r, size=size, bold=bold, italic=italic, color=color, name=name)
    return p


def add_heading(doc, text, level=1, color=PRIMARY, size=None, space_before=10, space_after=4):
    sizes = {1: 16, 2: 13, 3: 11.5}
    if size is None:
        size = sizes.get(level, 13)
    p = doc.add_paragraph()
    p.style = doc.styles[f"Heading {level}"]
    pf = p.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.keep_with_next = True
    pf.line_spacing = 1.0
    r = p.add_run(text)
    set_run_font(r, size=size, bold=True, color=color)
    return p


def add_bullet(doc, text, size=10, color=BLACK, space_after=1):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.75)
    pf.first_line_indent = Cm(-0.4)
    pf.space_after = Pt(space_after)
    pf.line_spacing = 1.0
    r = p.add_run("\u2022  " + text)
    set_run_font(r, size=size, color=color)
    return p


def set_cell_shading(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def set_cell_margins(cell, top=40, start=80, bottom=40, end=80):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement("w:tcMar")
        tcPr.append(tcMar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tcMar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tcMar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color="A30046", size=4):
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = tblPr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tblPr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = borders.find(qn(f"w:{edge}"))
        if el is None:
            el = OxmlElement(f"w:{edge}")
            borders.append(el)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)


def repeat_header_and_keep_rows(table, repeat_header=True):
    """Repeat first row on each page and prevent rows splitting across pages."""
    tbl = table._tbl
    tblPr = tbl.tblPr
    # repeat header row
    if repeat_header:
        for ri, row in enumerate(table.rows):
            trPr = row._tr.get_or_add_trPr()
            el = OxmlElement("w:tblHeader")
            el.set(qn("w:val"), "true" if ri == 0 else "false")
            trPr.append(el)
    # don't split rows
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        el = OxmlElement("w:cantSplit")
        trPr.append(el)


def style_cell(cell, text, size=9.5, bold=False, color=BLACK, align=None, fill=None):
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    if fill is not None:
        set_cell_shading(cell, fill)
    p = cell.paragraphs[0]
    p.text = ""
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    pf.space_before = Pt(1)
    pf.space_after = Pt(1)
    for i, line in enumerate(str(text).split("\n")):
        if i > 0:
            p = cell.add_paragraph()
            if align is not None:
                p.alignment = align
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
        r = p.add_run(line)
        set_run_font(r, size=size, bold=bold, color=color)


def add_field(paragraph, instruction):
    """Insert a Word field (e.g. PAGE) into a paragraph run."""
    run = paragraph.add_run()
    set_run_font(run, size=9, color=GREY)
    fldChar1 = OxmlElement("w:fldChar")
    fldChar1.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText")
    instrText.set(qn("xml:space"), "preserve")
    instrText.text = instruction
    fldChar2 = OxmlElement("w:fldChar")
    fldChar2.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)
    return run


def add_page_number(paragraph):
    run = paragraph.add_run()
    set_run_font(run, size=9, color=GREY)
    fld1 = OxmlElement("w:fldChar"); fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld2 = OxmlElement("w:fldChar"); fld2.set(qn("w:fldCharType"), "end")
    run._r.append(fld1); run._r.append(instr); run._r.append(fld2)


def add_footer_with_logo(section, fund_name="Melbourne Business School \u2013 Student Investment Fund"):
    footer = section.footer
    footer.is_linked_to_previous = False
    # Paragraph 1: thin magenta rule + fund name (left) + page number (right)
    p = footer.paragraphs[0]
    p.text = ""
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.tab_stops.add_tab_stop(Cm(16.0), WD_TAB_ALIGNMENT.RIGHT)
    # top border (magenta rule)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    top = OxmlElement("w:top")
    top.set(qn("w:val"), "single")
    top.set(qn("w:sz"), "6")
    top.set(qn("w:space"), "4")
    top.set(qn("w:color"), "A30046")
    pBdr.append(top)
    pPr.append(pBdr)

    r = p.add_run(fund_name)
    set_run_font(r, size=9, color=GREY)
    r2 = p.add_run("\t")
    set_run_font(r2, size=9, color=GREY)
    add_page_number(p)

    # Paragraph 2: MBS logo bottom-right
    p2 = footer.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    pf2 = p2.paragraph_format
    pf2.space_before = Pt(2)
    pf2.space_after = Pt(0)
    run = p2.add_run()
    run.add_picture(ASSETS["logo"], height=Pt(26))


def add_toc_entry(doc, text, page_num, level=1):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(3)
    pf.tab_stops.add_tab_stop(Cm(16.0), WD_TAB_ALIGNMENT.RIGHT, leader=WD_TAB_LEADER.DOTS)
    if level == 1:
        pf.left_indent = Cm(0)
    else:
        pf.left_indent = Cm(0.7)
    r = p.add_run(text)
    set_run_font(r, size=11 if level == 1 else 10.5, bold=(level == 1), color=BLACK)
    r2 = p.add_run("\t" + str(page_num))
    set_run_font(r2, size=11 if level == 1 else 10.5, bold=(level == 1), color=BLACK)
    return p


# ---------------------------------------------------------------------------
# Build the document
# ---------------------------------------------------------------------------
doc = Document()

# Page setup: A4, reasonable margins (mirror original single-column report)
sec = doc.sections[0]
sec.page_width = Mm(210)
sec.page_height = Mm(297)
sec.top_margin = Cm(2.0)
sec.bottom_margin = Cm(2.2)
sec.left_margin = Cm(2.0)
sec.right_margin = Cm(2.0)

# Base style
normal = doc.styles["Normal"]
normal.font.name = BODY_FONT
normal.font.size = Pt(10)
normal.font.color.rgb = BLACK
normal.paragraph_format.line_spacing = 1.0
normal.paragraph_format.space_after = Pt(4)
rpr = normal.element.get_or_add_rPr()
rfonts = rpr.get_or_add_rFonts()
rfonts.set(qn("w:ascii"), BODY_FONT)
rfonts.set(qn("w:hAnsi"), BODY_FONT)
rfonts.set(qn("w:eastAsia"), BODY_FONT)
rfonts.set(qn("w:cs"), BODY_FONT)

# Heading styles
for lvl, (sz, col) in {1: (16, PRIMARY), 2: (13, PRIMARY), 3: (11.5, DARK)}.items():
    st = doc.styles[f"Heading {lvl}"]
    st.font.name = BODY_FONT
    st.font.size = Pt(sz)
    st.font.bold = True
    st.font.color.rgb = col
    st.paragraph_format.space_before = Pt(10)
    st.paragraph_format.space_after = Pt(4)
    st.element.rPr.rFonts.set(qn("w:ascii"), BODY_FONT)
    st.element.rPr.rFonts.set(qn("w:hAnsi"), BODY_FONT)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    st.element.rPr.rFonts.set(qn("w:cs"), BODY_FONT)

# ===========================================================================
# COVER PAGE
# ===========================================================================
# MBS logo top-left
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.LEFT
p.paragraph_format.space_after = Pt(30)
p.add_run().add_picture(ASSETS["logo"], height=Pt(44))

add_para(doc, "Melbourne Business School", size=34, bold=True, color=PRIMARY,
         space_before=0, space_after=0)
add_para(doc, "Student Investment Fund", size=34, bold=True, color=PRIMARY,
         space_before=0, space_after=10)
add_para(doc, "Investment Recommendation", size=22, bold=True, color=DARK,
         space_before=0, space_after=30)

add_para(doc, "Westpac Banking Corporation", size=24, bold=True, color=BLACK,
         space_before=0, space_after=2)
add_para(doc, "ASX code: WBC", size=15, color=GREY, space_after=30)

analysts = [
    "James Purcell (Senior Analyst \u2013 Active Australian Equities)",
    "Lachlan Kendrick (Senior Analyst \u2013 Active Australian Equities)",
    "Lavanya Singhal (Analyst - Active Australian Equities)",
]
for a in analysts:
    add_para(doc, a, size=12, color=BLACK, space_after=2)

add_para(doc, "", space_after=24)
add_para(doc, "Creation date: 07/05/2026 | Version date: 13/05/2026",
         size=11, color=GREY, space_after=0)

doc.add_page_break()

# ===========================================================================
# TABLE OF CONTENTS
# ===========================================================================
add_heading(doc, "Table of Contents", level=1, space_before=0)
toc = [
    ("Glossary", 3, 1),
    ("Portfolio Recommendation", 4, 1),
    ("Investment Thesis", 4, 1),
    ("Original Investment Thesis", 4, 2),
    ("Why The Position Should be Sold", 5, 2),
    ("Model Evolution", 5, 2),
    ("Investment Case", 7, 1),
    ("Execution Risks Associated with the UNITE Initiative", 7, 2),
    ("Rising Credit Risk", 7, 2),
    ("Structural NIM Compression", 8, 2),
    ("Risks to the Sell Recommendation", 9, 1),
    ("Sustained Investor Demand", 9, 2),
    ("Successful UNITE Execution", 9, 2),
    ("Macroeconomic Tailwinds", 9, 2),
    ("Model Summary", 10, 1),
    ("Net Revenue", 10, 2),
    ("Operating Costs", 11, 2),
    ("Impairments", 11, 2),
    ("Scenario Analysis", 11, 1),
    ("Valuation Summary and Recommendation", 11, 1),
    ("Appendix", 13, 1),
    ("Appendix A: Key Financial Summary", 13, 2),
    ("Appendix B: Scenario Analysis", 16, 2),
    ("Appendix C: Sensitivity Analysis", 20, 2),
]
for text, page, lvl in toc:
    add_toc_entry(doc, text, page, level=lvl)

add_para(doc, "", space_after=12)
add_heading(doc, "Notes:", level=2, color=DARK)
notes = (
    "This report is made available for the sole purpose of demonstrating the analysis "
    "undertaken by students enrolled in the University\u2019s Student Investment Fund and its "
    "related courses and has been prepared by students who are not licensed to provide "
    "financial product advice under the Corporations Act 2001. The information provided does "
    "not constitute and should not be relied upon as financial product advice. For financial "
    "product advice that takes account of particular objectives, financial situation and "
    "needs, readers should consult an Australian Financial Services licensee."
)
add_para(doc, notes, size=10, color=GREY, space_after=0)

doc.add_page_break()

# ===========================================================================
# GLOSSARY
# ===========================================================================
add_heading(doc, "Glossary", level=1, space_before=0)
glossary = [
    "AAE \u2013 Active Australian Equities",
    "MBS \u2013 Melbourne Business School",
    "APRA \u2013 Australian Prudential Regulation Authority",
    "ASX \u2013 Australian Securities Exchange",
    "AUSTRAC \u2013 Australian Transaction Reports and Analysis Centre",
    "CAPM \u2013 Capital Asset Pricing Model",
    "CBA \u2013 Commonwealth Bank of Australia",
    "CET1 \u2013 Common Equity Tier 1",
    "CTI \u2013 Cost-to-income ratio",
    "DCF \u2013 Discounted cash flow",
    "ETP \u2013 Exchange traded product",
    "FCFE \u2013 Free cash flow to equity",
    "FSRC \u2013 Financial Services Royal Commission",
    "FY \u2013 Financial year",
    "GICS \u2013 Global Industry Classification Standard",
    "IAC \u2013 Investment Advisory Committee",
    "IOZ \u2013 iShares Core S&P/ASX 200 ETF",
    "IPART \u2013 Independent Pricing and Regulatory Tribunal",
    "LVR \u2013 Loan-to-value ratio",
    "MoS \u2013 Margin of safety",
    "NAB \u2013 National Australia Bank",
    "NII \u2013 Net Interest Income",
    "NIM \u2013 Net Interest Margin",
    "NPAT \u2013 Net profit after tax",
    "RAMS \u2013 Raters and Mortgage Solutions (Westpac subsidiary)",
    "RBA \u2013 Reserve Bank of Australia",
    "ROE \u2013 Return on equity",
    "RWA \u2013 Risk-weighted assets",
    "SME \u2013 Small to medium sized enterprise",
    "SIF \u2013 Melbourne Business School Student Investment Fund",
    "WACC \u2013 Weighted average cost of capital",
    "WBC \u2013 Westpac Banking Corporation",
]
# two-column glossary table (2 cols x 16 rows)
t = doc.add_table(rows=16, cols=2)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_borders(t, color="FFFFFF", size=2)
for i, item in enumerate(glossary):
    row = i // 2
    col = i % 2
    cell = t.cell(row, col)
    style_cell(cell, item, size=10, fill=None)
    set_cell_margins(cell, top=30, start=40, bottom=30, end=40)

doc.add_page_break()

# ===========================================================================
# PORTFOLIO RECOMMENDATION  (two-column: body | stats box + chart)
# ===========================================================================
add_heading(doc, "Portfolio Recommendation", level=1, space_before=0)

rec_body = [
    ("The AAE Team recommends that the Student Investment Fund (SIF) sell its entire active "
     "position in Westpac Banking Corporation (WBC) within the Active Australian Equities "
     "portfolio, with the proceeds to be invested in the iShares Core S&P/ASX 200 ETF (IOZ)."),
    ("WBC is an Australian-based financial services and banking company operating across "
     "Consumer, Business, Institutional, and New Zealand banking segments, serving individuals, "
     "SMEs, corporates, and government customers. The fund purchased WBC in May 2019 at $27.14 "
     "per share, and the position has generated total returns of 8.6% p.a over the holding period."),
    ("WBC has been a successful holding for the SIF, but at the current share price the "
     "prospective return no longer adequately compensates for the risks ahead."),
    ("Westpac\u2019s cost-to-income ratio of ~54% is the highest of the big four banks, and its "
     "UNITE program, a $3.5 billion technology overhaul to close this gap, is the central "
     "assumption underpinning its current valuation. The program is already delayed, over budget, "
     "and delivery uncertainty has been compounded by the simultaneous departure of both the "
     "Group CIO and CTO in early 2026. At the same time, Westpac\u2019s NIM is under structural "
     "pressure, as aggressive mortgage discounting, heavy reliance on broker-originated loans, "
     "and a deposit base skewed toward higher-cost accounts compress profitability from both "
     "sides. WBC is also pursuing aggressive volume growth in home and business lending at "
     "precisely the point in the cycle when borrower stress is emerging and impairments are "
     "rising. Together, these issues present material risks and the valuation leaves little room "
     "for error."),
]

# Build a 2-column layout table
layout = doc.add_table(rows=1, cols=2)
layout.alignment = WD_TABLE_ALIGNMENT.CENTER
layout.autofit = False
set_table_borders(layout, color="FFFFFF", size=0)
# enforce fixed layout
tblPr = layout._tbl.tblPr
layout_el = OxmlElement("w:tblLayout")
layout_el.set(qn("w:type"), "fixed")
tblPr.append(layout_el)
left = layout.cell(0, 0)
right = layout.cell(0, 1)
left.width = Cm(10.2)
right.width = Cm(6.6)
set_cell_margins(left, end=220)
set_cell_margins(right, start=120)

# Left: body paragraphs
left_p = left.paragraphs[0]
left_p.paragraph_format.space_after = Pt(3)
for i, para in enumerate(rec_body):
    if i > 0:
        left_p = left.add_paragraph()
        left_p.paragraph_format.space_after = Pt(3)
    r = left_p.add_run(para)
    set_run_font(r, size=9.5, color=BLACK)

# Right: stats box
stats = [
    ("AUSTRALIA", None, "hdr"),
    ("ASX code: WBC", None, "hdr"),
    ("Price (12/05/2026)", "$36.61", "row"),
    ("Valuation (exc. FC)", "$23.18", "row"),
    ("Margin of safety (MoS) (exc. FC)", "-36.69%", "row"),
    ("Valuation (inc. FC)", "$34.04", "row"),
    ("Margin of safety (MoS) (inc. FC)", "-7.03%", "row"),
    ("Ordinary cash dividend yield", "4.14%", "row"),
    ("Dividend yield (inc FC)", "5.91%", "row"),
    ("GICS", "Financials", "row"),
    ("52-week range", "$30.27 - $43.32", "row"),
    ("Recommendation", "Sell", "rec"),
    ("Key assumptions", None, "hdr"),
    ("Cost of Equity", "8.39%", "row"),
]
right_p = right.paragraphs[0]
right_p.text = ""
box = right.add_table(rows=0, cols=2)
box.autofit = False
set_table_borders(box, color="A30046", size=4)
for label, value, kind in stats:
    row = box.add_row()
    c0, c1 = row.cells
    c0.width = Cm(4.2)
    c1.width = Cm(2.2)
    set_cell_margins(c0, top=18, start=50, bottom=18, end=30)
    set_cell_margins(c1, top=18, start=30, bottom=18, end=50)
    if kind == "hdr":
        merged = c0.merge(c1)
        style_cell(merged, label, size=9, bold=True, color=PRIMARY)
    elif kind == "rec":
        style_cell(c0, label, size=9, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), fill="A30046")
        style_cell(c1, value, size=9, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), fill="A30046")
    else:
        style_cell(c0, label, size=8.5, color=BLACK, fill="F2E3EA")
        style_cell(c1, value, size=8.5, color=BLACK, align=WD_ALIGN_PARAGRAPH.RIGHT, fill="F2E3EA")

# Chart below the stats box (in right column)
chart_p = right.add_paragraph()
chart_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
chart_p.paragraph_format.space_before = Pt(5)
chart_p.add_run().add_picture(ASSETS["price_chart"], width=Cm(5.5))
cap_p = right.add_paragraph()
cap_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
cap_p.paragraph_format.space_after = Pt(0)
cap_r = cap_p.add_run("Five-year price history")
set_run_font(cap_r, size=8.5, italic=True, color=GREY)

# Investment Thesis section
add_heading(doc, "Investment Thesis", level=1, space_before=6)
add_heading(doc, "Original Investment Thesis", level=2, space_before=6)
add_para(doc, "The SIF\u2019s original investment thesis identified the following drivers of long-term value:")
bullets = [
    "high asset and loan book quality",
    "high sustainable dividend yield supported by strong ROE, amplified by WBC\u2019s fully franked dividends",
    "exposure to Australia\u2019s oligopolistic banking sector with strong pricing power",
    "strong management, franchise strength and SRI practices",
    "post-FSRC restructuring as a tailwind, with tighter lending standards and mortgage broking reform to steer customers toward the major banks",
]
for b in bullets:
    add_bullet(doc, b)

# ===========================================================================
# WHY THE POSITION SHOULD BE SOLD
# ===========================================================================
add_heading(doc, "Why The Position Should be Sold", level=2, space_before=0)
p1 = ("WBC\u2019s investment thesis has largely materialised across the identified strategic areas "
      "since the Fund\u2019s initial purchase. Loan book quality has been a clear outperformer, with "
      "credit impairment charges averaging just 0.10% of loans over FY2021-2025, materially below "
      "the original model\u2019s forecast of 0.33%. WBC has maintained fully franked dividends "
      "throughout the holding period, with the gross yield on cost recovering to approximately 7.8% "
      "including franking credits in FY2025, reflecting the significant income return the position "
      "has generated for the SIF. The oligopolistic structure of Australian banking has remained "
      "intact, with the big four collectively holding approximately 70% of total domestic lending "
      "assets. Governance and franchise strength were significantly tested by the $1.3 billion "
      "AUSTRAC penalty in FY2020, but WBC has since executed a meaningful turnaround under new "
      "leadership, with regulatory overlays lifted and risk management practices substantially "
      "improved. However, pricing power has dissipated more than the original thesis anticipated, "
      "with NIM compressing from 2.08% at purchase to 1.95% in FY2025 as deposit and mortgage "
      "competition have created structural pressure on margins.")
add_para(doc, p1)

p2 = ("Against this backdrop, the stock has appreciated ~37% over the holding period while providing "
      "the Fund with significant fully franked dividend income. Realisation of the original "
      "investment thesis, sector-wide re-ratings and structural demand from compulsory "
      "superannuation inflows into major bank equities have been key drivers of this appreciation. "
      "The position has delivered strong returns for the SIF. However, we believe the risks "
      "associated with holding WBC outweigh the prospects for further return, and that is why we "
      "recommend the SIF sell Westpac.")
add_para(doc, p2)

add_para(doc, "The team\u2019s investment case for a sell is driven by:")
for b in [
    "Execution risks associated with the UNITE initiative",
    "NIM compression in a mature, competitive market.",
    "Emerging credit risk headwinds",
]:
    add_bullet(doc, b)

add_heading(doc, "Model Evolution", level=2)
add_para(doc,
    "The AAE team\u2019s DCF model produces a target share price of $34.04 including FC, implying a "
    "MoS of \u20137.03%. To provide a clearer context on the development of WBC\u2019s fundamentals "
    "and our updated view, the table below compares key forecast drivers in the current model "
    "iteration against the last revaluation (S2 2025).")

model_rows = [
    ("Metric", "Current Model (Updated)", "Prior Model (21/7/25)"),
    ("Average Interest Earning Assets (FY2026)", "$1,077,561", "$986,122"),
    ("NIM (FY26-FY2035)", "1.91%-1.84%", "1.90%-1.86%"),
    ("Cost-to-income ratio (FY2026-2035)", "55.3%-47%", "52.15%-45%"),
    ("Impairments % Loans (FY2025-2031)", "0.11-0.16", "0.08-0.14"),
    ("Target Price Incl FC", "$34.04", "$39.75"),
]
mt = doc.add_table(rows=len(model_rows), cols=3)
mt.alignment = WD_TABLE_ALIGNMENT.CENTER
set_table_borders(mt, color="D9BFCB", size=4)
for ri, row in enumerate(model_rows):
    for ci, val in enumerate(row):
        cell = mt.cell(ri, ci)
        if ri == 0:
            style_cell(cell, val, size=10, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), fill="A30046")
        else:
            style_cell(cell, val, size=10, bold=(ci == 0), color=BLACK,
                       fill="F2E3EA" if ri % 2 == 0 else None)

add_para(doc, "")
add_para(doc,
    "Average interest earning asset growth has been revised upward to reflect Westpac\u2019s "
    "volume-led strategy and elevated 1H26 momentum, particularly the 23% surge in institutional "
    "lending. While positive in isolation, this reinforces our views on future impairments as "
    "growth is concentrating in more exposed segments where credit risk is rising. Impairment "
    "charges are forecast to step up from the low of 5\u20138bps in FY22\u20131H26 to 16bps by FY30, "
    "slightly above 15 basis point normalised levels, reflecting the unwinding of pandemic-era "
    "credit conditions and building stress in the institutional book. NIM has been revised "
    "downward, tapering from 1.94% in FY25 to 1.84% in the terminal year, reflecting a more "
    "persistent structural decline driven by sector wide pressures and WBC\u2019s specific loan book "
    "composition. Our model still assumes a meaningful reduction in the cost base over the forecast "
    "period from the UNITE initiative. However, cost-to-income has been revised upward as our view "
    "on UNITE execution has deteriorated and now declines from ~54% to ~47% by FY35. The combined "
    "effect is a reduction in NPAT across the forecast period. These revisions produce a target "
    "price of $34.04 vs $39.75, bringing the margin of safety to a level at which we no longer "
    "view the risk-reward as favourable.")

doc.add_page_break()

# ===========================================================================
# INVESTMENT CASE
# ===========================================================================
add_heading(doc, "Investment Case", level=1, space_before=0)
add_heading(doc, "Execution Risks Associated with the UNITE Initiative", level=2)
add_heading(doc, "The Strategic Importance of Unite", level=3)
add_para(doc,
    "A key risk to WBC is the execution of its UNITE program, which underpins the market\u2019s "
    "thesis for holding the stock. UNITE is a $3.5 billion technology overhaul aimed at "
    "simplifying legacy systems and consolidating approximately 180 platforms into 60, addressing "
    "the structural inefficiency that has accumulated through decades of acquisitions, including "
    "St George, BankSA and BT, which were never fully integrated into a unified technology "
    "environment. Westpac\u2019s cost-to-income ratio of ~54% remains materially above peers and "
    "has been the highest of all big four banks during the holding period. This structural cost "
    "disadvantage has been a persistent drag on ROE, with Westpac\u2019s five-year average ROE of "
    "~9.0% trailing NAB, CBA and ANZ which averaged ~11.4% over the same period. Management has "
    "itself positioned UNITE as the primary vehicle for closing this gap, targeting roughly $750 "
    "million in annual savings by 2030. UNITE is currently the largest standalone transformation "
    "program amongst peers, accounting for approximately 40 per cent of WBC\u2019s total investment "
    "spend through FY27 and FY28. By comparison, ANZ\u2019s $1.5 billion annual investment envelope "
    "is dispersed across transformation, growth and regulatory work, while NAB and CBA have no "
    "similar programs. Successful delivery is a key determinant of WBC\u2019s intrinsic value and "
    "further upside. Our scenario analysis reflects this significance, illustrated by a more severe "
    "execution failure of UNITE producing a margin of safety including FC of \u201326.2% with a "
    "target price of $29.01 against a base case valuation of $34.04.")

add_heading(doc, "Execution Risk and Delivery Uncertainty", level=3)
add_para(doc,
    "The scale and complexity of UNITE introduces meaningful execution risk. The program\u2019s "
    "completion date has already slipped from FY28 to FY29 following a decision to consolidate to a "
    "single deposit ledger, requiring around one-third of initiatives to be replanned. Investment "
    "spend has also escalated, with FY26 guidance of $850-950 million up from $660 million in "
    "FY25. As many of the costs are expensed rather than capitalised, this creates a direct "
    "headwind to earnings. The simultaneous departure of both the Group CIO and CTO in early 2026 "
    "has further compounded delivery uncertainty, removing the two executives most directly "
    "responsible for the program\u2019s delivery at a critical juncture. With UNITE absorbing around "
    "40% of total investment spend through FY27 and FY28, execution failure carries outsized "
    "consequences for WBC\u2019s medium-term earnings profile and, by extension, its valuation.")

add_heading(doc, "Rising Credit Risk", level=2)
add_heading(doc, "A Decade of Benign Credit Conditions", level=3)
add_para(doc,
    "Rising credit risk, compounded by macroeconomic headwinds, poses a material and long-term "
    "threat to Westpac. Australian banks have benefited from a decade of benign credit conditions, "
    "with loan impairment charges averaging just 0.10% of loans over FY2021-2025. This environment "
    "is now reversing as pandemic-era savings buffers are exhausted and the RBA\u2019s tightening "
    "cycle flows through to households. The $282 million collective provision overlay for "
    "energy-intensive sectors, taken in 1H26, is an implicit acknowledgement that this risk is not "
    "yet fully reflected in headline metrics. Compounding this, total business lending grew 15% in "
    "1H26, driven by a 23% surge in institutional lending into energy, infrastructure, critical "
    "minerals and property finance, the same sectors explicitly overlaid for credit risk. To put "
    "this into context, Westpac\u2019s peers grew the business lending book by ~10% on average over "
    "the same period. The composition of Westpac\u2019s A$527 billion mortgage book is also "
    "skewing toward higher-risk segments, with the investor lending share rising to 33% and "
    "first-home buyer exposure growing to 12.6% through aggressive participation in the federal 5% "
    "deposit scheme at up to 95% LVR. Australian mortgage 90-day delinquencies stand at 0.57%, "
    "already above the pre-pandemic norm of 0.41% and on a rising trajectory, with the pandemic-era "
    "savings buffer that insulated households through the hiking cycle now substantially exhausted.")

add_heading(doc, "Early Warning Signs", level=3)
add_para(doc,
    "Evidence of rising credit risk in the near term is already present. Although headline "
    "stability metrics remain intact, with a CET1 ratio of 12.3% and stressed exposures broadly "
    "contained, the underlying trajectory is deteriorating. Royal Commission reforms and tighter "
    "capital requirements have structurally improved the quality of bank loan books, and we are "
    "not forecasting a full regime change in credit conditions. However, the normalisation toward "
    "pre-pandemic impairment levels, combined with Westpac\u2019s concentration in the most exposed "
    "segments of the economy, is a material risk to earnings over the forecast period.")

add_heading(doc, "Westpac\u2019s Loan Book Composition", level=3)
add_para(doc,
    "Westpac\u2019s loan book composition amplifies this sector-wide credit risk. Construction, one "
    "of Westpac\u2019s most material business lending segments, is highly cyclical and acutely "
    "sensitive to the current rate environment. Westpac\u2019s skew toward investor and first-home "
    "buyer mortgages, its above-system growth in business lending, and its concentration in "
    "energy-intensive institutional sectors all increase the sensitivity of the loan book to a "
    "deteriorating credit environment relative to peers.")

add_heading(doc, "Structural NIM Compression", level=2)
add_para(doc,
    "Westpac faces structural net interest margin (NIM) compression that is both sector-wide and "
    "idiosyncratic to its own business mix. At the sector level, the competitive backdrop has "
    "intensified materially. Mortgage lending has become a price-driven race, with banks "
    "aggressively discounting rates to defend volume, squeezing the margin earned on new "
    "originations. Competition for deposits has increased similarly as banks compete for cheaper, "
    "more stable sources of funding. This dynamic is compounded by the fact that following the "
    "Banking Royal Commission, the major banks largely exited high-yielding wealth management and "
    "insurance businesses, while simultaneously ceding ground in fee-generating verticals including "
    "payments, merchant acquiring, and foreign exchange. With these alternative revenue levers "
    "unavailable, NIM compression flows directly to the bottom line, reducing earnings and "
    "undermining Westpac\u2019s capacity to sustain the dividend yield that has historically "
    "defined its investment appeal.")
add_para(doc,
    "Westpac\u2019s structural vulnerabilities compound this industry-wide pressure in distinct "
    "ways. Its reliance on mortgage brokers to originate new lending structurally erodes per-loan "
    "profitability, as a portion of margin is transferred to these third parties. As of 1Q26, "
    "proprietary channels accounted for just 44.4% of Westpac\u2019s mortgage originations, "
    "compared to 33% for CBA which indicates a more advanced hollowing-out of the "
    "direct-to-customer channel that underpins higher-margin lending. Westpac\u2019s retail deposit "
    "base also skews disproportionately toward higher-cost repricing savings accounts and term "
    "deposits, rather than the zero-cost transaction accounts that anchor competitors\u2019 funding "
    "bases. This structurally inflates interest expense, compressing the spread from both sides. "
    "Finally, Westpac\u2019s fragmented technology infrastructure which the UNITE program is "
    "attempting to remediate, impairs the bank\u2019s ability to reprice its loan book nimbly in "
    "response to RBA cash rate movements. This latency means Westpac is slower to capture margin "
    "uplift in rising rate environments and slower to defend against compression when rates fall, "
    "placing it at a systematic disadvantage relative to peers with more agile systems.")

doc.add_page_break()

# ===========================================================================
# RISKS TO THE SELL RECOMMENDATION
# ===========================================================================
add_heading(doc, "Risks to the Sell Recommendation", level=1, space_before=0)
add_heading(doc, "Sustained Investor Demand", level=2)
add_para(doc,
    "A key risk to the recommendation is that capital continues to rotate into big four banks "
    "because of their entrenched position in Australian equity markets. The big 4 banks account "
    "for 26% of ASX 200 holdings, meaning passive inflows into Australian indices create ongoing "
    "buying support. Passive investors account for 45% of the Australian Share Market and ETP "
    "ownership have quadrupled since 2020. Because index-tracking funds allocate capital strictly "
    "in proportion to index weights, inflows into Australian equity products mechanically increase "
    "demand for the big four regardless of performance. This creates a structural source of buying "
    "that supports bank share prices independently of fundamentals.")
add_para(doc,
    "Compulsory superannuation adds to this structural demand by directing a meaningful share of "
    "the approximately $180 billion in mandated annual contributions toward Australian equities. "
    "This demand is reinforced as superannuation funds\u2019 performance is benchmarked against the "
    "ASX 200 and assessed on a short-term basis. As a result, fund managers have limited incentive "
    "to hold underweight positions in major index constituents, as doing so creates active risk "
    "against the benchmark. This means that even discretionary capital is often deployed broadly in "
    "line with index weights, sustaining demand for financials such as Westpac independently of "
    "fundamentals.")
add_para(doc,
    "This demand is further supported by the structural role banks play as high yielding dividend "
    "stocks in Australia. Westpac\u2019s 4.14% fully franked dividend yield is particularly valuable "
    "to Australian investors because franking credits eliminate the double taxation of company "
    "profits. In periods of heightened market uncertainty, investors may also favour large, "
    "well-capitalised and systemically important banks over smaller or more concentrated exposures. "
    "This is particularly relevant in the current environment, where the RBA\u2019s rate hike to "
    "4.35% could see investors rotate away from rate-sensitive growth stocks and toward large-cap, "
    "income-producing names such as the major banks.")

add_heading(doc, "Successful UNITE Execution", level=2)
add_para(doc,
    "A key risk to this sell recommendation is that WBC delivers UNITE better than, or in line with "
    "expectations. Successful delivery would materially strengthen the credibility of the targeted "
    "~$750 million in annual savings by 2030, supporting a meaningful reduction in Westpac\u2019s "
    "cost-to-income ratio and closing the gap against peers. This would in turn lift ROE from the "
    "9.77% recorded in FY25 toward peer-level returns, directly addressing the structural "
    "underperformance that has weighed on the bank\u2019s earnings quality. As more initiatives are "
    "delivered and execution uncertainty fades, the share price would likely benefit from "
    "progressive de-risking of the program, with each completed milestone reinforcing investor "
    "confidence and reducing the likelihood of further derating events like the FY25 timeline "
    "extension. Over time, this dynamic could support multiple expansion, particularly if delivery "
    "momentum is sustained through the most technically complex stages of the program. This "
    "introduces the risk of selling a stock that compounds returns through dividend income while "
    "simultaneously experiencing capital appreciation because of its transformation progress.")

add_heading(doc, "Macroeconomic Tailwinds", level=2)
add_para(doc,
    "The current macroeconomic environment could act as a tailwind for WBC\u2019s earnings while "
    "reinforcing its defensive appeal at a time when the broader portfolio is exposed to "
    "volatility. The RBA\u2019s three cash rate hikes in 2026 to 4.35% have been passed on in full "
    "to variable mortgage borrowers while deposit repricing has lagged, widening the spread between "
    "lending and funding costs and supporting NIM expansion. Sustained higher rates also "
    "progressively lift returns on Westpac\u2019s low-cost transaction account deposits as the "
    "funding base is reinvested at higher yields, providing further structural uplift to NIM. In "
    "the current environment of elevated volatility and macroeconomic uncertainty, Westpac\u2019s "
    "defensive profile is reinforced by a CET1 ratio of 12.3%, well above APRA\u2019s 10.5% "
    "benchmark. Further, Westpac\u2019s systemically important status and fully franked dividend "
    "yield are particularly relevant for the SIF, whose tax-exempt status amplifies franking "
    "credits and makes franked income a key contributor to its annual distribution obligations. "
    "Selling into a backdrop that may support both Westpac\u2019s earnings and its defensive "
    "characteristics therefore risks compromising capital returns and a reliable source of franked "
    "income at a time when much of the SIF\u2019s wider portfolio is exposed to elevated cyclical "
    "and macroeconomic risk.")

# ===========================================================================
# MODEL SUMMARY
# ===========================================================================
add_heading(doc, "Model Summary", level=1)
add_para(doc,
    "Westpac reported modest net interest income growth in 1H26 supported by 4% lending growth and "
    "3% deposit growth, with mortgages excluding RAMS growing at 1.2x system and continued momentum "
    "across institutional, business and consumer segments. Core NIM, excluding the timing impact of "
    "rate rises, held steady in 2Q26, though group NIM remains under pressure from sustained "
    "mortgage and deposit competition. CEO Anthony Miller flagged the impact of the Middle East "
    "conflict and energy market disruption as material headwinds for the operating environment, "
    "with elevated inflation and energy input costs expected to flow through to households and "
    "businesses across the remainder of FY26, prompting an increase in collective provisions "
    "through a portfolio overlay for energy-intensive sectors. Statutory net profit of $3.4bn "
    "declined 5% on 2H25 (down 1% ex-notable items), partially reflecting $75m in transaction costs "
    "associated with the pending RAMS divestment. CET1 remained robust at 12.4%, comfortably above "
    "the 11.25% target, supporting the 77 cent fully franked interim dividend.")

add_heading(doc, "Net Revenue", level=2)
add_para(doc,
    "Westpac\u2019s net revenue has been forecast as Net Interest Income (NII) plus Non-Interest "
    "Income, consistent with how the bank reports its top line. NII is the primary driver and is "
    "built bottom-up as Average Interest Earning Assets \u00d7 Net Interest Margin. Non-interest "
    "income is forecast by sub-line. Combining this together, net revenue growth tapers from ~3.9% "
    "in FY26 to ~3.6% in the medium term as above-system loan growth in housing and business "
    "lending is progressively offset by NIM compression in a competitive market, with the long-run "
    "path anchored to a 1.84% terminal NIM and ~4.4% asset growth.")

add_heading(doc, "Average Interest Earning Assets", level=2)
add_para(doc,
    "Average interest earning assets (AIEA) are modelled bottom-up across housing, business, "
    "personal and non-lending books, with the trajectory of each book aligned to management\u2019s "
    "strategy. This bottom-up approach produces average interest earning asset growth of 4.90% and "
    "5.1% in FY26 and FY27 with strong near-term momentum across Westpac\u2019s lending divisions. "
    "Growth tapers from 5.0% in FY2028 to 4.4% across the remainder of the forecast period aligned "
    "to nominal GDP growth. Elevated near-term growth reflects Westpac\u2019s aggressive pursuit of "
    "volume in margin-dilutive segments and a shift toward business lending at a point in the cycle "
    "characterised by rising credit risk. A detailed explanation of growth rates for each AIEA type "
    "is provided in appendix D.")

doc.add_page_break()

# ===========================================================================
# NET INTEREST MARGIN / OPERATING COSTS / IMPAIRMENTS
# ===========================================================================
add_heading(doc, "Net Interest Margin", level=2, space_before=0)
add_para(doc,
    "NIM is forecast against broker consensus, drawing on estimates from JPMorgan, Morgans, Goldman "
    "Sachs, Morningstar and Evans & Partners. The near-term NIM of 1.90% in FY26 reflects a partial "
    "offset from the higher cash rate environment, which provides a tailwind to higher margins. "
    "However, Westpac\u2019s aggressive volume-driven lending strategy, reliance on higher-cost "
    "repricing deposits, and intensifying mortgage market competition structurally compress margins "
    "over the forecast period and NIM tapers to a long-run floor of 1.84% in the terminal year. "
    "This is consistent with the ongoing structural decline in Australian bank NIMs.")

add_heading(doc, "Operating Costs", level=2)
add_para(doc,
    "While Westpac\u2019s 1H26 result provides no guidance on operating costs, FY25 operating "
    "expenses increased 9% to $11.92 billion. The increase reflects a $273 million pre-tax "
    "restructuring charge for the Fit for Growth productivity program, $660 million of UNITE "
    "investment of which 76% was expensed, higher software amortisation, deliberate hiring in "
    "business banking to support lending growth, and elevated regulatory and compliance costs. "
    "Operating costs have been modelled as the sum of staff, technology, occupancy and other "
    "expenses, with growth forecasted individually for each component. Combined, FY26 operating "
    "expense of $12.0 billion has been forecast at ~2% over most of the forecast period. A detailed "
    "explanation of line-item forecasts can be found in appendix D.")

add_heading(doc, "Impairments", level=2)
add_para(doc,
    "Impairments are forecast as a percentage charge of lending assets, with the ratio set at 11 "
    "basis points in FY26, stepping up to 15 basis points across FY29 and settling at 16 basis "
    "points from FY30 onwards. This sits above WBC\u2019s recent steady-state experience of 5 to 8 "
    "basis points (FY22 to 1H26) and at the pre-pandemic 5-year average, reflecting a mid-cycle "
    "normalisation as the current benign credit environment fades and energy-related stress in "
    "WBC\u2019s institutional book builds. Whilst we have not incorporated a full regime change, "
    "there is an assumption incorporated that underlying credit risk will return to normalised "
    "pre-covid levels.")

add_heading(doc, "Scenario Analysis", level=1)
add_para(doc,
    "We modelled multiple scenarios to capture the range of potential outcomes for Westpac. The "
    "bear case reflects downside risks from execution failure on the UNITE program and structural "
    "NIM compression in a competitive operating environment. The bull case captures upside from "
    "successful UNITE delivery and the realisation of targeted cost savings and sustained NIM "
    "expansion through repricing discipline and balance sheet mix improvements. Together, these "
    "scenarios highlight that while Westpac\u2019s upside depends on flawless execution against an "
    "already demanding valuation, downside risks remain material across all three core pillars of "
    "the investment case. A full breakdown of the scenario assumptions, valuation deltas, and "
    "weighting methodology is provided in Appendix B.")

add_heading(doc, "Valuation Summary and Recommendation", level=1)
add_para(doc,
    "After evaluating the return and risk trade-off, our assessment is that the risk of holding WBC "
    "at its current valuation outweighs the potential upside. WBC is trading at $36.61 against our "
    "base case valuation of $34.04 including franking credits, implying a negative margin of safety "
    "of 7.03%. The Sell recommendation rests on the view that the original investment thesis has "
    "largely played out, and the current market valuation is being driven by entrenched banking "
    "sector sentiment, superannuation inflows and UNITE speculation rather than fundamental "
    "strength. Beneath these tailwinds, the underlying fundamentals are deteriorating. Credit risk "
    "is rising as pandemic-era conditions unwind and Westpac\u2019s loan book skews toward "
    "higher-risk segments, while NIM has compressed from 2.08% at purchase to 1.95% in FY25 under "
    "competitive pressure and structural weaknesses. At the same time, the market continues to "
    "price in successful execution of the UNITE program despite material execution risk. With "
    "upside dependent on the continuity of favourable sector sentiment and the successful execution "
    "of a technically complex UNITE program, we recommend the SIF sell its entire active position "
    "in Westpac Banking Corporation (WBC) and invest the proceeds into the iShares Core S&P/ASX200 "
    "ETF (IOZ).")

doc.add_page_break()

# ===========================================================================
# APPENDIX
# ===========================================================================
add_heading(doc, "Appendix", level=1, space_before=0)
add_heading(doc, "Appendix A: Key Financial Summary", level=2)

def add_financial_table(header, rows):
    t = doc.add_table(rows=len(rows), cols=len(header))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    set_table_borders(t, color="D9BFCB", size=4)
    repeat_header_and_keep_rows(t)
    widths = [Cm(4.4)] + [Cm(1.4)] * (len(header) - 1)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = t.cell(ri, ci)
            cell.width = widths[ci]
            set_cell_margins(cell, top=14, start=40, bottom=14, end=30)
            if ri == 0:
                style_cell(cell, val, size=8, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), fill="A30046",
                           align=WD_ALIGN_PARAGRAPH.CENTER if ci > 0 else None)
            elif val in ("Volume", "Margin & revenue", "Costs", "Credit quality", "Profitability", "FCFE bridge"):
                style_cell(cell, val, size=8, bold=True, color=PRIMARY, fill="F2E3EA")
            else:
                bold = (ci == 0)
                style_cell(cell, val, size=8, bold=bold, color=BLACK,
                           align=WD_ALIGN_PARAGRAPH.RIGHT if ci > 0 else None)
    return t

fin1_header = ["Financial year (AUD million)", "2020(A)", "2021(A)", "2022(A)", "2023(A)", "2024(A)", "2025(A)", "2026(E)", "2027(E)"]
fin1_rows = [
    fin1_header,
    ["Volume", "", "", "", "", "", "", "", ""],
    ["Average interest-earning assets", "$822,203", "$842,244", "$854,472", "$894,268", "$885,237", "$1,026,879", "$1,077,561", "$1,132,275"],
    ["AIEA growth", "-", "2.4%", "1.5%", "4.7%", "(1.0%)", "16.0%", "4.9%", "5.1%"],
    ["Margin & revenue", "", "", "", "", "", "", "", ""],
    ["Net interest margin (NIM)", "2.03%", "2.06%", "1.94%", "1.95%", "1.95%", "1.94%", "1.91%", "1.90%"],
    ["Net revenue", "$20,183", "$21,222", "$19,606", "$21,645", "$21,588", "$22,384", "$23,505", "$24,894"],
    ["Net revenue growth", "-", "5.1%", "(7.6%)", "10.4%", "(0.3%)", "3.7%", "3.9%", "3.7%"],
    ["Costs", "", "", "", "", "", "", "", ""],
    ["Operating expenses", "($12,739)", "($13,311)", "($10,802)", "($10,692)", "($10,944)", "($11,916)", "($12,092)", "($12,692)"],
    ["Cost-to-income ratio", "63.1%", "62.7%", "55.1%", "49.4%", "50.7%", "53.2%", "51.4%", "51.0%"],
    ["Credit quality", "", "", "", "", "", "", "", ""],
    ["Loan impairment expense", "($3,178)", "$590", "($335)", "($648)", "($537)", "($424)", "($988)", "($1,170)"],
    ["Impairment/average loans", "0.45%", "-0.08%", "0.05%", "0.08%", "0.07%", "0.05%", "0.11%", "0.12%"],
    ["Profitability", "", "", "", "", "", "", "", ""],
    ["NPAT", "$2,290", "$5,458", "$5,694", "$7,201", "$6,990", "$6,916", "$7,068", "$7,334"],
    ["NPAT growth", "-", "138.3%", "4.3%", "26.5%", "(2.9%)", "(1.1%)", "2.2%", "3.8%"],
    ["FCFE bridge", "", "", "", "", "", "", "", ""],
    ["Risk-weighted assets (RWA)", "$437,905", "$436,650", "$477,620", "$451,418", "$437,430", "$450,048", "$474,127", "$498,201"],
    ["CET1 ratio", "11.3%", "12.4%", "10.6%", "11.5%", "11.5%", "11.7%", "11.5%", "11.5%"],
    ["Net CET1 capital", "$49,453", "$54,314", "$50,722", "$52,273", "$50,454", "$52,582", "$54,525", "$57,293"],
    ["\u0394 CET1 (retention required)", "-", "$3,564", "($5,136)", "$2,250", "($1,774)", "$1,623", "$2,335", "$3,171"],
    ["Free cash flow to equity (FCFE)", "$2,290", "$1,894", "$10,830", "$4,951", "$8,764", "$5,293", "$4,733", "$4,163"],
]
add_financial_table(fin1_header, fin1_rows)

add_para(doc, "", space_after=4)

fin2_header = ["Financial year (AUD million)", "FY28E", "FY29E", "FY30E", "FY31E", "FY32E", "FY33E", "FY34E", "FY35E"]
fin2_rows = [
    fin2_header,
    ["Volume", "", "", "", "", "", "", "", ""],
    ["Average interest earning assets ($m)", "$1,188,978", "$1,243,226", "$1,300,613", "$1,359,983", "$1,421,424", "$1,484,205", "$1,549,190", "$1,618,035"],
    ["AIEA growth", "5.0%", "4.6%", "4.6%", "4.6%", "4.5%", "4.4%", "4.4%", "4.4%"],
    ["Margin & revenue", "", "", "", "", "", "", "", ""],
    ["Net interest margin (NIM)", "1.89%", "1.88%", "1.87%", "1.86%", "1.85%", "1.84%", "1.84%", "1.84%"],
    ["Net revenue ($m)", "$24,973", "$25,840", "$26,717", "$27,571", "$28,425", "$29,273", "$30,134", "$31,019"],
    ["Net revenue growth (YoY)", "3.6%", "3.5%", "3.4%", "3.2%", "3.1%", "3.0%", "2.9%", "2.9%"],
    ["Costs", "", "", "", "", "", "", "", ""],
    ["Operating expenses ($m)", "($12,536)", "($12,809)", "($13,089)", "($13,381)", "($13,758)", "($14,150)", "($14,312)", "($14,711)"],
    ["Cost-to-income ratio (CTI)", "50.2%", "49.6%", "49.0%", "48.5%", "48.4%", "48.3%", "47.5%", "47.4%"],
    ["Credit quality", "", "", "", "", "", "", "", ""],
    ["Impairments ($m)", "($1,426)", "($1,591)", "($1,747)", "($1,843)", "($1,919)", "($1,995)", "($2,072)", "($2,152)"],
    ["Impairment/average loans", "0.14%", "0.15%", "0.16%", "0.16%", "0.16%", "0.16%", "0.16%", "0.16%"],
    ["Profitability", "", "", "", "", "", "", "", ""],
    ["Net profit after tax ($m)", "$7,635", "$7,956", "$8,274", "$8,598", "$8,865", "$9,142", "$9,428", "$9,589"],
    ["NPAT growth (YoY)", "4.1%", "4.2%", "4.0%", "3.9%", "3.1%", "3.1%", "3.1%", "3.0%"],
    ["FCFE bridge", "", "", "", "", "", "", "", ""],
    ["Risk-weighted assets (RWA)", "$523,150", "$547,019", "$572,270", "$598,000", "$625,358", "$652,967", "$681,542", "$711,812"],
    ["CET1 ratio", "11.5%", "11.5%", "11.5%", "11.5%", "11.5%", "11.5%", "11.5%", "11.5%"],
    ["Net CET1 capital", "$60,162", "$62,907", "$65,811", "$68,770", "$71,916", "$75,091", "$78,377", "$81,858"],
    ["\u0394 CET1 (retention required)", "$3,282", "$3,168", "$3,337", "$3,403", "$3,601", "$3,642", "$3,765", "$3,971"],
    ["Free cash flow to equity (FCFE)", "$4,353", "$4,788", "$4,937", "$5,195", "$5,263", "$5,501", "$5,663", "$5,618"],
]
add_financial_table(fin2_header, fin2_rows)

doc.add_page_break()

# ===========================================================================
# APPENDIX B: SCENARIO ANALYSIS
# ===========================================================================
add_heading(doc, "Appendix B: Scenario Analysis", level=2, space_before=0)
add_heading(doc, "Bear Scenario 1: UNITE Execution Failure \u2014 Cost-Out Targets Not Realised", level=3)
add_para(doc,
    "This scenario models the risk that Westpac fails to execute the UNITE program substantially as "
    "planned, with the targeted ~$750 million in annual savings by 2030 not materialising and the "
    "cost-to-income ratio remaining at or near current levels.")
add_para(doc, "Valuation: $20.28 w/o FC (-44.6% Margin of Safety), $29.13 w FC (-20.44% Margin of Safety)", bold=True)
add_para(doc,
    "Rationale: UNITE is the central pillar underpinning the market\u2019s willingness to pay a "
    "premium for Westpac. A failure to deliver the targeted cost-out, whether through further "
    "timeline slippage, cost overruns, or operational incidents during migration, would leave "
    "Westpac structurally disadvantaged on cost-to-income relative to CBA and NAB and constrain ROE "
    "expansion over the medium/long run. Given that the program will absorb approximately 40% of "
    "total investment spend through FY27 and FY28 with the majority expensed rather than "
    "capitalised, execution failure means the SIF would absorb years of elevated cost without the "
    "corresponding earnings benefit, materially compressing intrinsic value.")
add_para(doc,
    "Model Changes: Cost-to-income ratio remains elevated at historical levels of 54% throughout the "
    "forecast period, instead of declining toward the targeted ~48% by FY30. Modelled by heightened "
    "staff expenses (compressing from 3% in FY26 to only 2% in steady-state), occupancy expenses "
    "(stabilising at 3% in steady-state) and technology expenses (remaining elevated at 5% in "
    "steady-state). Subsequently, housing and business lending capacity reduces 2% in steady-state "
    "instead of the 3.8% and 4%, respectively, modelled in the base case.")
add_para(doc, "Bear Case Weighting: 40%", bold=True, color=DARK)

add_heading(doc, "Bear Scenario 2: Sustained NIM Compression \u2014 Margin Defence Fails", level=3)
add_para(doc,
    "This scenario models the risk that competitive pressures in mortgage and deposit markets, "
    "combined with Westpac\u2019s structural disadvantages, drive NIM materially below current "
    "levels through the forecast period.")
add_para(doc, "Valuation: $17.06 w/o FC (-53.39% Margin of Safety), $26.15 w FC (-28.58% Margin of Safety)", bold=True)
add_para(doc,
    "Rationale: With NIM accounting for approximately 85% of major bank revenue, sustained margin "
    "compression flows almost directly to the bottom line. Westpac\u2019s structural reliance on "
    "broker-originated mortgages (only 44.4% of originations through proprietary channels versus "
    "33% for CBA), its higher-cost deposit mix skewed toward repricing savings and term deposits, "
    "and its fragmented technology that limits repricing agility all amplify the sector-wide "
    "pressure on margins. With wealth, insurance and fee-generating verticals already exited or "
    "ceded, Westpac has limited offsets available to defend earnings if NIM compresses further from "
    "its current 1.95% level.")
add_para(doc,
    "Model Changes: Group NIM is stepped down by 15 basis points each year in the forecast period "
    "from the FY26 level of 1.87% in the base case, falling to 1.44% by FY35. This is modelled "
    "through sustained mortgage discounting, broker channel reliance, and higher-cost deposit "
    "growth outpacing transaction account balances.")
add_para(doc, "Bear Case Weighting: 20%", bold=True, color=DARK)

add_heading(doc, "Bull Scenario 1: UNITE Delivers Ahead of Plan \u2014 Full Cost-Out Realised", level=3)
add_para(doc, "Valuation: $27.81 w/o FC (-24.05% Margin of Safety), $40.67 w FC (+11.08% Margin of Safety)", bold=True)
add_para(doc,
    "Rationale: Successful execution of UNITE in line with, or ahead of, current expectations would "
    "validate management\u2019s ~$750 million in annual cost savings and materially improve "
    "Westpac\u2019s cost-to-income ratio relative to peers. Each delivered milestone progressively "
    "de-risks the program in the eyes of investors, supporting further share price appreciation.")
add_para(doc,
    "Model Changes: Cost-to-income ratio declines to approximately 48% by FY28 ahead of management "
    "guidance of by FY30 with further compression to ~39% by FY35. This is modelled by massive "
    "decreases in technology expenses (down to 0.5% FY31 onwards), occupancy expenses (continued "
    "compression in line with historicals, -0.5% in steady state) and staff expenses (compressing "
    "to 0.5% across the forecast period) due to UNITE efficiency gains and subsequent, rapid hikes "
    "in housing and business lending.")
add_para(doc, "Bull Case Weighting: 20%", bold=True, color=DARK)

add_heading(doc, "Bull Scenario 2: NIM Expansion Through Repricing Discipline", level=3)
add_para(doc, "Valuation: $30.62 w/o FC (-16.35% Margin of Safety), $44.95 w FC (+22.77% Margin of Safety)", bold=True)
add_para(doc,
    "Rationale: A reacceleration of inflation requiring the RBA to maintain higher cash rates for "
    "longer, combined with rational competitive behaviour across the major banks and successful "
    "repricing of Westpac\u2019s loan book, allows NIM to expand from current levels. Successful "
    "UNITE delivery also improves repricing agility, allowing Westpac to capture a greater share of "
    "margin uplift in higher-rate environments. Stronger institutional and business banking growth "
    "in higher-margin segments further supports group NIM, partially offsetting ongoing mortgage "
    "pressure.")
add_para(doc,
    "Model Changes: Group NIM expands by 15 basis points from the FY25 level of 1.94% to 2.05\u2013"
    "2.1% across the forecast period (FY26E\u2013FY30E). Business lending remains elevated at 8% and "
    "housing lending at 4% in steady state.")
add_para(doc, "Bull Case Weighting: 20%", bold=True, color=DARK)

# ===========================================================================
# WEIGHTED SCENARIO ANALYSIS TABLES + APPENDIX D
# ===========================================================================
add_heading(doc, "Weighted Scenario Analysis \u2013 UNITE Execution", level=2, space_before=12)

def add_weighted_table(header, rows):
    t = doc.add_table(rows=len(rows), cols=len(header))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t, color="D9BFCB", size=4)
    repeat_header_and_keep_rows(t)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = t.cell(ri, ci)
            if ri == 0:
                style_cell(cell, val, size=9.5, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), fill="A30046")
            else:
                style_cell(cell, val, size=9.5, bold=(ci == 0), color=BLACK,
                           fill="F2E3EA" if ri % 2 == 0 else None,
                           align=WD_ALIGN_PARAGRAPH.RIGHT if ci > 0 else None)
    return t

add_weighted_table(
    ["", "Bear Case (Disastrous Execution)", "Base Case (Partial, mediocre execution)", "Bull Case (exceptional execution)", "Final"],
    [
        ["", "Bear Case (Disastrous Execution)", "Base Case (Partial, mediocre execution)", "Bull Case (exceptional execution)", "Final"],
        ["Weight", "40%", "40%", "20%", "100%"],
        ["Valuation (excl. FC)", "$20.28 (MoS: -44.6%)", "$23.18 (MoS: -36.69%)", "$27.81 (MoS: -24.05%)", "$22.95 (MoS: -37.33%)"],
        ["Valuation (incl. FC)", "$29.13 (MoS: -20.44%)", "$34.04 (MoS: -7.03%)", "$40.67 (MoS: 11.08%)", "$33.4 (MoS: -8.77%)"],
    ],
)

add_para(doc, "", space_after=8)

add_heading(doc, "Weighted Scenario Analysis \u2013 NIM Trajectory", level=2)
add_weighted_table(
    ["", "Bear Case (Massive NIM Compression)", "Base Case (Partial NIM Compression)", "Bull Case (Rapid NIM Expansion)", "Final"],
    [
        ["", "Bear Case (Massive NIM Compression)", "Base Case (Partial NIM Compression)", "Bull Case (Rapid NIM Expansion)", "Final"],
        ["Weight", "20%", "60%", "20%", "100%"],
        ["Valuation (excl. FC)", "$17.06 (MoS: -53.39%)", "$23.18 (MoS: -36.69%)", "$30.62 (MoS: -16.35%)", "$23.44 (MoS: -35.96%)"],
        ["Valuation (incl. FC)", "$26.15 (MoS: -28.58%)", "$34.04 (MoS: -7.03%)", "$44.95 (MoS: 22.77%)", "$34.64 (MoS: -5.38%)"],
    ],
)

add_para(doc, "", space_after=6)

add_heading(doc, "Appendix D: Average Interest Earning Asset Growth", level=2)
add_para(doc,
    "Housing loans are forecast with reference to Australian residential credit growth, "
    "incorporating mortgage affordability, household disposable income, residential property prices "
    "and Westpac\u2019s historical system capture rate. Near-term growth is set at 5.0% in FY26, in "
    "line with the 4% 1H26 reported figure and 1.2x system capture, with a deceleration as rising "
    "RBA rates tighten system growth. Over the medium term, growth moderates to ~4.3% by FY28 as "
    "system capture steps down toward 85% reflecting the unwind of WBC\u2019s volume-led strategy "
    "and normalisation toward system growth. Long run falls to ~4.0% by FY31, anchored to the "
    "10-year average Australian residential credit growth rate of 5.4% per annum, with WBC\u2019s "
    "75% historical average capture of system growth applied as an overlay in a mature, competitive "
    "market.")
add_para(doc,
    "Business lending growth is forecast with reference to Australian nominal GDP growth, with a "
    "qualitative overlay. Near-term growth remains elevated at 10% in FY2026, reflecting strong "
    "1H26 momentum across Westpac\u2019s institutional and business banking divisions and its "
    "deliberate strategy to deploy capital into this segment. Longer term growth tapers to "
    "Australian nominal GDP growth and the forecast expects growth in business loans as a "
    "proportion of total loans. This reflects WBC\u2019s pursuit of volume in the business book and "
    "its shift toward higher risk weighted assets.")

doc.add_page_break()

# ===========================================================================
# OPEX GRAPH + COST OF EQUITY
# ===========================================================================
add_heading(doc, "OPEX Graph forecast", level=2, space_before=0)
op = doc.add_paragraph()
op.alignment = WD_ALIGN_PARAGRAPH.CENTER
op.add_run().add_picture(ASSETS["opex_chart"], width=Cm(13.5))

add_para(doc,
    "Staff expenses, historically the largest line, are forecast to grow at 1% in the near-term in "
    "line with RBA wage growth guidance of around 3% and accounting for the AI job displacements "
    "with an increase toward 2-3% from FY30 driven by wage growth in senior management positions as "
    "AI continues to displace lower-level jobs. Occupancy expenses contract in the short term, "
    "reflecting the Fit for Growth restructuring implemented in 2H FY25, the elimination of 200 "
    "teller roles, and a leaner physical footprint as digital banking reduces spatial needs. Growth "
    "stabilises modestly below long-run CPI from FY28 onward, consistent with ongoing branch "
    "consolidation.")
add_para(doc,
    "Technology expenses, the second-largest line, is expected to front-load modestly in the near "
    "term as UNITE reaches peak deployment, before stabilising at 4\u20135% annual growth FY29 "
    "onwards as decommissioning of legacy systems yields efficiency savings \u2014 Morningstar notes "
    "that material cost savings are expected once banking systems are decommissioned late in FY2028, "
    "supporting the tapering growth profile thereafter as reinvestment normalises to a sustainable "
    "rate consistent with maintaining the technology base.")

add_heading(doc, "Cost of Equity", level=2)
add_para(doc,
    "The model applies a cost of equity of 8.39%, derived using CAPM. Risk-free rate is calculated "
    "using the Australian 10-year Government bond yield which has traded in the 4.3\u20134.7% range "
    "through the valuation period, approaching multi-decade highs amid elevated inflation and "
    "expectations of sustained higher interest rates. Applied against a market risk premium of "
    "approximately 6%, consistent with the long-run historical estimate used by Australian "
    "regulators like IPART, and a beta of 1.07, it reflects the defensive, oligopolistic "
    "characteristics of Australian major bank equities. This produces a cost of equity in the range "
    "of 8\u20139%. This is broadly consistent with third-party estimates: Alpha Spread calculates "
    "CBA\u2019s cost of equity at 7.79% using a beta of 0.75 and a risk-free rate of 4.7%, while "
    "Wallet Investor estimates WBC\u2019s cost of equity at 8.12% assuming a lower beta of 0.80. A "
    "cost of equity at the lower end of this band is reasonable for Westpac: as an institution "
    "subject to APRA oversight, WBC benefits from implicit government support backstop that "
    "compresses tail risk relative to non-financial corporates. Fully franked dividends reduce the "
    "effective required pre-tax return for Australian resident investors, and its market position "
    "provides earnings stability that justifies the near-market beta. However, the UNITE execution "
    "risk, structural NIM headwinds, and ROE remaining below peers introduces idiosyncratic risks "
    "that prevent a further reduction in the discount rate, supporting 8.39% as an appropriate "
    "estimate.")

doc.add_page_break()

# ===========================================================================
# APPENDIX C: SENSITIVITY ANALYSIS
# ===========================================================================
add_heading(doc, "Appendix C: Sensitivity Analysis", level=2, space_before=0)

def add_sensitivity_table(title, header, rows):
    add_para(doc, title, size=12, bold=True, color=DARK, space_before=6, space_after=4)
    t = doc.add_table(rows=len(rows), cols=len(header))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t, color="D9BFCB", size=4)
    repeat_header_and_keep_rows(t)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = t.cell(ri, ci)
            if ri == 0:
                style_cell(cell, val, size=9.5, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), fill="A30046",
                           align=WD_ALIGN_PARAGRAPH.CENTER)
            else:
                highlight = (ri == 6)  # base case row
                style_cell(cell, val, size=9.5, bold=highlight, color=BLACK,
                           fill="F2E3EA" if highlight else None,
                           align=WD_ALIGN_PARAGRAPH.CENTER)
    add_para(doc, "", space_after=4)

add_sensitivity_table(
    "NIM",
    ["NIM", "Valuation w/o FC", "MoS w/o FC", "Valuation w/ FC", "MoS w/ FC"],
    [
        ["NIM", "Valuation w/o FC", "MoS w/o FC", "Valuation w/ FC", "MoS w/ FC"],
        ["-0.25%", "$12.99", "-64.53%", "$20.88", "-42.95%"],
        ["-0.20%", "$15.02", "-58.96%", "$23.52", "-35.77%"],
        ["-0.15%", "$17.06", "-53.39%", "$26.15", "-28.58%"],
        ["-0.10%", "$19.10", "-47.82%", "$28.78", "-21.40%"],
        ["-0.05%", "$21.14", "-42.25%", "$31.41", "-14.21%"],
        ["0.00%", "$23.18", "-36.69%", "$34.04", "-7.03%"],
        ["0.05%", "$25.22", "-31.12%", "$36.67", "0.15%"],
        ["0.10%", "$27.26", "-25.55%", "$39.30", "7.34%"],
        ["0.15%", "$29.30", "-19.98%", "$41.93", "14.52%"],
        ["0.20%", "$31.33", "-14.41%", "$44.56", "21.71%"],
        ["0.25%", "$33.37", "-8.84%", "$47.19", "28.89%"],
    ],
)

doc.add_page_break()

add_sensitivity_table(
    "Cost of equity (Ke)",
    ["Ke", "Valuation w/o FC", "MoS w/o FC", "Valuation w/ FC", "MoS w/ FC"],
    [
        ["Ke", "Valuation w/o FC", "MoS w/o FC", "Valuation w/ FC", "MoS w/ FC"],
        ["-2.00%", "$36.59", "-0.04%", "$53.93", "47.30%"],
        ["-1.50%", "$31.95", "-12.72%", "$47.04", "28.48%"],
        ["-1.00%", "$28.36", "-22.52%", "$41.72", "13.95%"],
        ["-0.50%", "$25.51", "-30.33%", "$37.48", "2.39%"],
        ["0.00%", "$23.18", "-36.69%", "$34.04", "-7.03%"],
        ["0.50%", "$21.24", "-41.97%", "$31.17", "-14.85%"],
        ["1.00%", "$19.61", "-46.43%", "$28.76", "-21.44%"],
        ["1.50%", "$18.21", "-50.25%", "$26.70", "-27.08%"],
        ["2.00%", "$17.01", "-53.55%", "$24.91", "-31.96%"],
    ],
)

doc.add_page_break()

# ===========================================================================
# CONTACT DETAILS
# ===========================================================================
add_heading(doc, "Contact details", level=1, space_before=0)
add_para(doc, "SIF email: sif@mbs.edu", size=11, space_after=4)
add_para(doc, "SIF website: https://mbs.edu/student-investment-fund", size=11, space_after=4)
add_para(doc, "SIF Facebook page: https://www.facebook.com/mbsstudentinvestmentfund", size=11, space_after=4)
add_para(doc, "SIF LinkedIn page: https://www.linkedin.com/company/mbs-student-investment-fund", size=11, space_after=14)

add_para(doc, "Melbourne Business School", size=11, bold=True, space_after=2)
add_para(doc, "The University of Melbourne", size=11, space_after=2)
add_para(doc, "+61 3 9349 8100", size=11, space_after=10)
add_para(doc, "Melbourne Business School", size=11, bold=True, space_after=2)
add_para(doc, "200 Leicester Street, Carlton VIC 3053 Australia", size=11, space_after=2)
add_para(doc, "www.mbs.edu", size=11, space_after=10)
add_para(doc, "CRICOS Provider No. 00116K", size=11, space_after=0)

# ---------------------------------------------------------------------------
# Footer: fund name + page number + MBS logo (bottom-right)
# ---------------------------------------------------------------------------
add_footer_with_logo(doc.sections[0])

out_path = "MBS Student Investment Fund - Westpac - Sell S1 2026.docx"
doc.save(out_path)
print("Saved:", out_path)
