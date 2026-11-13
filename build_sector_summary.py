#!/usr/bin/env python3
"""Build 'ASX Financials - Sector Summary' as a Melbourne Business School
Student Investment Fund Word document.

Styling is reused from build_mbs_docx.py (Calibri, MBS magenta palette,
MBS logo in footer and on cover). Content is read from a markdown file so
the writing pipeline (draft -> edit -> build) stays independent of styling.
"""

import json
import re
import sys

from docx import Document
from docx.shared import Pt, RGBColor, Mm, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ---------------------------------------------------------------------------
# MBS brand palette (from MBS Investment Fund inaugural meeting deck)
# ---------------------------------------------------------------------------
PRIMARY = RGBColor(0xA3, 0x00, 0x46)   # MBS magenta
DARK    = RGBColor(0x5E, 0x00, 0x28)   # MBS dark maroon
TINT    = RGBColor(0xF2, 0xE3, 0xEA)   # light magenta tint (table shading)
GREY    = RGBColor(0x59, 0x59, 0x59)   # body/footer grey
BLACK   = RGBColor(0x21, 0x21, 0x21)   # near-black body text
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)

BODY_FONT = "Calibri"

LOGO = "assets_mbs_logo_transparent.png"


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


INLINE_RE = re.compile(r"(\*\*.+?\*\*|\*[^*]+?\*)")


def add_inline_runs(p, text, size=10, bold=False, italic=False, color=BLACK, name=BODY_FONT):
    for part in INLINE_RE.split(text):
        if not part:
            continue
        b, i, t = bold, italic, part
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            b, t = True, part[2:-2]
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            i, t = True, part[1:-1]
        r = p.add_run(t)
        set_run_font(r, size=size, bold=b, italic=i, color=color, name=name)


def add_body_para(doc, text, size=10, color=BLACK, space_after=4, align=None):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.line_spacing = 1.0
    if align is not None:
        p.alignment = align
    add_inline_runs(p, text, size=size, color=color)
    return p


def add_bullet(doc, text, size=10, color=BLACK, space_after=1):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.75)
    pf.first_line_indent = Cm(-0.4)
    pf.space_after = Pt(space_after)
    pf.line_spacing = 1.0
    r = p.add_run("\u2022  ")
    set_run_font(r, size=size, color=color)
    add_inline_runs(p, text, size=size, color=color)
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
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tblPr.append(borders)


def style_cell(cell, text, size=9.5, bold=False, color=BLACK, align=None, fill=None):
    cell.text = ""
    p = cell.paragraphs[0]
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    pf.space_before = Pt(1)
    pf.space_after = Pt(1)
    pf.line_spacing = 1.0
    add_inline_runs(p, text, size=size, bold=bold, color=color)
    if fill:
        set_cell_shading(cell, fill)
    set_cell_margins(cell, top=40, start=60, bottom=40, end=60)


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
    p = footer.paragraphs[0]
    p.text = ""
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.tab_stops.add_tab_stop(Cm(16.0), WD_TAB_ALIGNMENT.RIGHT)
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

    p2 = footer.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    pf2 = p2.paragraph_format
    pf2.space_before = Pt(2)
    pf2.space_after = Pt(0)
    run = p2.add_run()
    run.add_picture(LOGO, height=Pt(26))


def add_toc_entry(doc, text, page_num, level=1):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(3)
    pf.tab_stops.add_tab_stop(Cm(16.0), WD_TAB_ALIGNMENT.RIGHT, leader=WD_TAB_LEADER.DOTS)
    pf.left_indent = Cm(0) if level == 1 else Cm(0.7)
    r = p.add_run(text)
    set_run_font(r, size=11 if level == 1 else 10.5, bold=(level == 1), color=BLACK)
    if page_num:
        r2 = p.add_run("\t" + str(page_num))
        set_run_font(r2, size=11 if level == 1 else 10.5, bold=(level == 1), color=BLACK)
    return p


# ---------------------------------------------------------------------------
# Markdown parsing
# ---------------------------------------------------------------------------
def parse_markdown(md_text):
    """Return a list of ('h1'|'h2'|'h3'|'p'|'bullet'|'table', payload) tuples."""
    blocks = []
    lines = md_text.splitlines()
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].rstrip()
        if not line.strip():
            i += 1
            continue
        # heading
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            blocks.append((f"h{level}", m.group(2).strip()))
            i += 1
            continue
        # table
        if line.lstrip().startswith("|"):
            tbl_lines = []
            while i < n and lines[i].lstrip().startswith("|"):
                tbl_lines.append(lines[i].strip())
                i += 1
            blocks.append(("table", tbl_lines))
            continue
        # bullet
        m = re.match(r"^\s*[-*]\s+(.*)$", line)
        if m:
            blocks.append(("bullet", m.group(1).strip()))
            i += 1
            continue
        # paragraph (merge consecutive non-blank, non-special lines)
        para_lines = [line.strip()]
        i += 1
        while i < n and lines[i].strip() and not re.match(r"^(#{1,3}\s|\s*[-*]\s|\s*\|)", lines[i]):
            para_lines.append(lines[i].strip())
            i += 1
        blocks.append(("p", " ".join(para_lines)))
    return blocks


def parse_table(lines):
    rows = []
    for ln in lines:
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        rows.append(cells)
    if len(rows) >= 2 and all(re.fullmatch(r":?-{2,}:?", c) for c in rows[1]):
        rows.pop(1)  # markdown separator row
    return rows


def render_blocks(doc, blocks, page_break_before=frozenset()):
    for kind, payload in blocks:
        if kind in ("h1", "h2", "h3"):
            if payload in page_break_before:
                doc.add_page_break()
            level = int(kind[1])
            add_heading(doc, payload, level=level)
        elif kind == "p":
            add_body_para(doc, payload)
        elif kind == "bullet":
            add_bullet(doc, payload)
        elif kind == "table":
            rows = parse_table(payload)
            if not rows:
                continue
            ncols = max(len(r) for r in rows)
            t = doc.add_table(rows=len(rows), cols=ncols)
            t.alignment = WD_TABLE_ALIGNMENT.CENTER
            set_table_borders(t, color="A30046", size=4)
            for ri, row in enumerate(rows):
                for ci in range(ncols):
                    val = row[ci] if ci < len(row) else ""
                    cell = t.cell(ri, ci)
                    if ri == 0:
                        style_cell(cell, val, size=9.5, bold=True, color=WHITE, fill="A30046")
                    else:
                        fill = "F2E3EA" if ri % 2 == 0 else None
                        style_cell(cell, val, size=9.5, bold=False, color=BLACK, fill=fill)
            add_para(doc, "", size=6, space_after=2)


# ---------------------------------------------------------------------------
# Document assembly
# ---------------------------------------------------------------------------
GLOSSARY = [
    "ABS \u2013 Australian Bureau of Statistics; publishes CPI, GDP and labour-force data",
    "ACCC \u2013 Australian Competition and Consumer Commission; competition and consumer regulator",
    "ANZ \u2013 Australia and New Zealand Banking Group",
    "APRA \u2013 Australian Prudential Regulation Authority; regulator for banks, insurers and super funds",
    "Arrears \u2013 A loan whose repayments are overdue; \u201c90+ days\u201d means at least 90 days late",
    "A-REIT \u2013 Australian real estate investment trust (a listed property fund)",
    "ASIC \u2013 Australian Securities and Investments Commission; corporate and market conduct regulator",
    "ASX \u2013 Australian Securities Exchange (the share market itself)",
    "Basis point (bp) \u2013 One-hundredth of a percentage point (0.01%); 25bp equals 0.25%",
    "BDD \u2013 Bad and doubtful debts; another name for bank loan losses",
    "BNPL \u2013 Buy now, pay later; short-term instalment credit offered at the point of sale",
    "BoQ \u2013 Bank of Queensland",
    "Buyback (on-market) \u2013 A company buying its own shares on the exchange to return cash to shareholders",
    "Cash NPAT / cash earnings \u2013 A bank\u2019s preferred profit measure that excludes one-off (\u201cnotable\u201d) items; each bank defines it slightly differently",
    "Cash rate target \u2013 The RBA\u2019s target for the overnight interest rate between banks; the anchor for all other interest rates",
    "Catastrophe (cat) claims \u2013 Insurance claims from major natural events such as storms, floods and cyclones",
    "CBA \u2013 Commonwealth Bank of Australia",
    "CET1 (Common Equity Tier 1) \u2013 A bank\u2019s highest-quality capital, expressed as a percentage of risk-weighted assets",
    "Claims inflation \u2013 The rising cost of settling insurance claims, driven by repairs, materials and labour",
    "Combined operating ratio (COR) \u2013 Claims plus expenses as a percentage of premium; below 100% means an underwriting profit",
    "Cost-to-income ratio (CTI) \u2013 Operating expenses as a percentage of income; lower is better",
    "CPI \u2013 Consumer Price Index; the headline measure of inflation",
    "Dividend per share (DPS) \u2013 The dividend paid per share, usually quoted in cents per share (cps)",
    "EBTDA \u2013 Earnings before tax, depreciation and amortisation; a proxy for cash earnings",
    "Forward P/E \u2013 Share price divided by forecast earnings per share; a valuation multiple",
    "Franked (fully) \u2013 A dividend carrying a full tax credit because company tax has already been paid",
    "FUA \u2013 Funds under administration; client money held and administered on a platform",
    "FUM \u2013 Funds under management; money a manager actively invests",
    "FY \u2013 Financial year (Australian banks and insurers commonly end 30 June or 30 September)",
    "GDP \u2013 Gross Domestic Product; total economic output",
    "GWP \u2013 Gross written premium; total insurance premiums written in a period, before reinsurance",
    "IAG \u2013 Insurance Australia Group",
    "Impairment charge \u2013 The cost of loans expected to go bad, charged against profit",
    "Insurance margin \u2013 Insurance profit as a percentage of premium earned; a measure of underwriting profitability",
    "Lapse rate \u2013 The percentage of policyholders who cancel or do not renew their policy",
    "Managed account \u2013 A professionally managed investment portfolio held in the client\u2019s own name on a platform",
    "MBS \u2013 Melbourne Business School",
    "NAB \u2013 National Australia Bank",
    "Natural perils \u2013 Losses caused by natural events: storms, floods, cyclones, hail and bushfires",
    "Negative gearing \u2013 Borrowing to invest where costs exceed income, so the loss reduces taxable income",
    "Net flows / net inflows \u2013 New client money in, minus withdrawals",
    "NIM (Net interest margin) \u2013 The spread between what a bank earns on loans and pays on deposits, as a percentage of interest-earning assets",
    "NOHC \u2013 Non-operating holding company; the top regulatory entity above the operating businesses",
    "Notable / significant items \u2013 One-off or unusual items (e.g. restructuring, asset sales) excluded from \u201ccash\u201d profit",
    "NPAT \u2013 Net profit after tax",
    "Operational capital overlay \u2013 Extra capital a regulator requires on top of standard requirements",
    "Payout ratio \u2013 The percentage of profit paid out as dividends",
    "Perils allowance \u2013 The budget an insurer sets for expected natural-peril losses in a year",
    "P/E \u2013 Price-to-earnings ratio; share price divided by earnings per share",
    "Provisions \u2013 Balance-sheet allowance set aside to cover expected loan losses",
    "QBE \u2013 QBE Insurance Group",
    "Quota share \u2013 A reinsurance arrangement where the reinsurer takes a fixed percentage of every policy\u2019s premiums and claims",
    "RBA \u2013 Reserve Bank of Australia (the central bank)",
    "Reinsurance \u2013 Insurance that insurers buy to share large or extreme risks",
    "Replicating income \u2013 Earnings banks generate by investing capital and deposit funding in low-risk, interest-bearing assets",
    "Risk equalisation \u2013 A health-insurance mechanism that transfers money between funds to spread risk across the industry",
    "ROE \u2013 Return on equity; profit as a percentage of shareholders\u2019 equity",
    "ROTE \u2013 Return on tangible equity; profit as a percentage of equity excluding intangibles such as goodwill",
    "RWA \u2013 Risk-weighted assets; a bank\u2019s assets adjusted for credit risk, used to set capital requirements",
    "SIF \u2013 Melbourne Business School Student Investment Fund",
    "Statutory NPAT \u2013 Profit reported under accounting standards, including all one-off items",
    "Superannuation \u2013 Australia\u2019s compulsory retirement savings system",
    "Trimmed mean inflation \u2013 A measure of underlying inflation that strips out the most volatile price movements",
    "Underlying margin \u2013 An insurance margin adjusted to remove one-off or weather-driven volatility",
    "UOP \u2013 Underwriting operating profit; profit from an insurer\u2019s core underwriting business",
    "Wealth platform \u2013 Technology used by advisers and clients to hold, trade and administer investments",
]

NOTES = (
    "This report is made available for the sole purpose of demonstrating the analysis "
    "undertaken by students enrolled in the University\u2019s Student Investment Fund and its "
    "related courses and has been prepared by students who are not licensed to provide "
    "financial product advice under the Corporations Act 2001. The information provided does "
    "not constitute and should not be relied upon as financial product advice. For financial "
    "product advice that takes account of particular objectives, financial situation and "
    "needs, readers should consult an Australian Financial Services licensee."
)

COVER = {
    "kicker": "Sector Summary",
    "title": "ASX Financials",
    "subtitle": "Banking  \u00b7  Insurance  \u00b7  Non-Bank Financial Institutions",
    "prepared": "Melbourne Business School Student Investment Fund",
    "date": "10 November 2026",
    "version": "Creation date: 10/11/2026 | Version date: 10/11/2026",
}


def build_document(md_text, out_path, toc_pages=None):
    toc_pages = toc_pages or {}
    doc = Document()

    sec = doc.sections[0]
    sec.page_width = Mm(210)
    sec.page_height = Mm(297)
    sec.top_margin = Cm(2.0)
    sec.bottom_margin = Cm(2.2)
    sec.left_margin = Cm(2.0)
    sec.right_margin = Cm(2.0)

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10)
    normal.font.color.rgb = BLACK
    normal.paragraph_format.line_spacing = 1.0
    normal.paragraph_format.space_after = Pt(4)
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attr), BODY_FONT)

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

    add_footer_with_logo(sec)

    # ---- Cover page -----------------------------------------------------
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(30)
    p.add_run().add_picture(LOGO, height=Pt(44))

    add_para(doc, "Melbourne Business School", size=34, bold=True, color=PRIMARY,
             space_before=0, space_after=0)
    add_para(doc, "Student Investment Fund", size=34, bold=True, color=PRIMARY,
             space_before=0, space_after=10)
    add_para(doc, COVER["kicker"], size=22, bold=True, color=DARK,
             space_before=0, space_after=30)
    add_para(doc, COVER["title"], size=24, bold=True, color=BLACK,
             space_before=0, space_after=2)
    add_para(doc, COVER["subtitle"], size=15, color=GREY, space_after=30)
    add_para(doc, COVER["prepared"], size=12, color=BLACK, space_after=2)
    add_para(doc, COVER["date"], size=12, color=BLACK, space_after=24)
    add_para(doc, "", space_after=24)
    add_para(doc, COVER["version"], size=11, color=GREY, space_after=0)
    doc.add_page_break()

    # ---- Table of contents ----------------------------------------------
    add_heading(doc, "Table of Contents", level=1, space_before=0)
    blocks = parse_markdown(md_text)
    toc = [("Glossary", 1)]
    for kind, payload in blocks:
        if kind == "h1":
            toc.append((payload, 1))
        elif kind == "h2":
            toc.append((payload, 2))
    toc.append(("Contact details", 1))
    for text, lvl in toc:
        add_toc_entry(doc, text, toc_pages.get(text, ""), level=lvl)

    add_para(doc, "", space_after=12)
    add_heading(doc, "Notes:", level=2, color=DARK)
    add_para(doc, NOTES, size=10, color=GREY, space_after=0)
    doc.add_page_break()

    # ---- Glossary -------------------------------------------------------
    add_heading(doc, "Glossary", level=1, space_before=0)
    nrows = (len(GLOSSARY) + 1) // 2
    t = doc.add_table(rows=nrows, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t, color="FFFFFF", size=2)
    for i, item in enumerate(GLOSSARY):
        cell = t.cell(i // 2, i % 2)
        style_cell(cell, item, size=10, fill=None)
        set_cell_margins(cell, top=30, start=40, bottom=30, end=40)
    doc.add_page_break()

    # ---- Body -----------------------------------------------------------
    page_break_before = {"References", "Sources", "References & Sources"}
    render_blocks(doc, blocks, page_break_before=page_break_before)

    # ---- Contact details ------------------------------------------------
    doc.add_page_break()
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

    doc.core_properties.title = "ASX Financials \u2013 Sector Summary"
    doc.core_properties.subject = "Sector summary: banking, insurance, non-bank financial institutions"
    doc.core_properties.author = "Melbourne Business School Student Investment Fund"

    doc.save(out_path)
    return toc


def main():
    if len(sys.argv) < 3:
        print("usage: build_sector_summary.py <content.md> <out.docx> [toc_pages.json]")
        sys.exit(1)
    md_path, out_path = sys.argv[1], sys.argv[2]
    toc_pages = {}
    if len(sys.argv) > 3:
        with open(sys.argv[3]) as f:
            toc_pages = json.load(f)
    with open(md_path) as f:
        md_text = f.read()
    toc = build_document(md_text, out_path, toc_pages=toc_pages)
    print("built", out_path)
    print("toc entries:", [f"{t[0]} (L{t[1]})" for t in toc])


if __name__ == "__main__":
    main()
