from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "Deepam_Minda_Applied_ML_Engineer.pdf"


def paragraph(text, style):
    return Paragraph(text, style)


def section(title, styles):
    return [
        Spacer(1, 7),
        paragraph(title.upper(), styles["section"]),
        Spacer(1, 3),
        HRFlowable(width="100%", thickness=0.55, color=colors.HexColor("#BFC4BC"), spaceBefore=0, spaceAfter=6),
    ]


def two_column(left, right, left_style, right_style, widths=(127 * mm, 51 * mm)):
    table = Table([[paragraph(left, left_style), paragraph(right, right_style)]], colWidths=list(widths), hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def role_line(role, dates, styles):
    return two_column(role, dates, styles["role"], styles["role_date"])


def bullet(text, styles):
    return paragraph(f"- {text}", styles["bullet"])


def job(company, dates, roles, bullets, styles):
    company_header = two_column(company, dates, styles["company"], styles["date"])
    role_rows = [role_line(role, role_dates, styles) for role, role_dates in roles]

    first_block = [company_header, Spacer(1, 2)]
    for row in role_rows:
        first_block.extend([row, Spacer(1, 1)])
    if bullets:
        first_block.extend([Spacer(1, 2), bullet(bullets[0], styles)])

    content = [KeepTogether(first_block)]
    for item in bullets[1:]:
        content.extend([Spacer(1, 2.7), bullet(item, styles)])
    content.append(Spacer(1, 7))
    return content


def draw_page_number(canvas, document):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#747A73"))
    canvas.drawRightString(A4[0] - 16 * mm, 8.5 * mm, f"Page {document.page}")
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=13 * mm,
        bottomMargin=14 * mm,
        title="Deepam Minda - Applied ML Engineer Resume",
        author="Deepam Minda",
        subject="Applied ML Engineer, AI Engineer, Machine Learning Engineer",
    )

    palette = {
        "ink": colors.HexColor("#151815"),
        "muted": colors.HexColor("#555D55"),
        "accent": colors.HexColor("#916200"),
    }
    base = getSampleStyleSheet()
    styles = {
        "name": ParagraphStyle("name", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=23, leading=25, textColor=palette["ink"], spaceAfter=1),
        "title": ParagraphStyle("title", parent=base["Normal"], fontName="Helvetica", fontSize=11, leading=14, textColor=palette["accent"]),
        "contact": ParagraphStyle("contact", parent=base["Normal"], fontName="Helvetica", fontSize=8.8, leading=11, textColor=palette["muted"]),
        "section": ParagraphStyle("section", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=palette["ink"], tracking=0.55),
        "summary": ParagraphStyle("summary", parent=base["Normal"], fontName="Helvetica", fontSize=9.6, leading=13.1, textColor=palette["ink"]),
        "company": ParagraphStyle("company", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=10.2, leading=12, textColor=palette["ink"]),
        "date": ParagraphStyle("date", parent=base["Normal"], fontName="Helvetica", fontSize=8.7, leading=11, textColor=palette["muted"], alignment=2),
        "role": ParagraphStyle("role", parent=base["Normal"], fontName="Helvetica-Oblique", fontSize=9, leading=11, textColor=palette["muted"]),
        "role_date": ParagraphStyle("role_date", parent=base["Normal"], fontName="Helvetica-Oblique", fontSize=8.5, leading=11, textColor=palette["muted"], alignment=2),
        "bullet": ParagraphStyle("bullet", parent=base["Normal"], fontName="Helvetica", fontSize=9.35, leading=12.8, leftIndent=10, firstLineIndent=-8, textColor=palette["ink"]),
        "skills": ParagraphStyle("skills", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=11.8, textColor=palette["ink"]),
        "education": ParagraphStyle("education", parent=base["Normal"], fontName="Helvetica", fontSize=9.2, leading=11.8, textColor=palette["ink"]),
    }

    story = [
        paragraph("Deepam Minda", styles["name"]),
        paragraph("Applied ML Engineer | AI Engineer", styles["title"]),
        Spacer(1, 4),
        paragraph(
            "Delhi NCR, India  |  +91 97110 24291  |  deepamminda99@gmail.com  |  "
            '<link href="https://www.linkedin.com/in/mindadeepam">linkedin.com/in/mindadeepam</link>  |  '
            '<link href="https://github.com/mindadeepam">github.com/mindadeepam</link>',
            styles["contact"],
        ),
    ]

    story += section("Professional Summary", styles)
    story.append(
        paragraph(
            "Applied ML Engineer with 4+ years of experience building and operating production AI systems across multimodal agents, "
            "document intelligence, computer vision, NLP, forecasting, and backend automation. Owns systems end to end - from data "
            "and model evaluation through APIs, orchestration, cloud deployment, monitoring, and human-in-the-loop operations - with "
            "measurable improvements in automation coverage, throughput, and decision quality.",
            styles["summary"],
        )
    )

    story += section("Technical Skills", styles)
    skill_rows = [
        ("Generative AI and Agents", "LLM agents, multi-agent architectures, LangChain, LangGraph, DSPy, RAG, tool calling, structured outputs, persistent memory, prompt and harness engineering, multimodal AI, evaluation, OpenAI, Gemini, OpenRouter, Pydantic"),
        ("Machine Learning", "PyTorch, Hugging Face Transformers, scikit-learn, OpenCV, SAM, DenseNet, CLIP, sentence transformers, SetFit, fine-tuning, few-shot learning, contrastive learning, classification, segmentation, forecasting, model evaluation"),
        ("Backend and MLOps", "Python, FastAPI, Celery, REST APIs, Docker, AWS EC2/ECS/SQS/SNS, GCP Cloud Functions, GitHub Actions, CI/CD, event-driven and scheduled workflows, authentication, logging, monitoring, Sentry, CloudWatch"),
        ("Data", "SQL, PostgreSQL, MongoDB, Redis, MySQL, Databricks, pandas, NumPy, SQLAlchemy, data pipelines, feature engineering"),
    ]
    for label, values in skill_rows:
        story.extend([paragraph(f"<b>{label}:</b> {values}", styles["skills"]), Spacer(1, 2.2)])

    story += section("Professional Experience", styles)
    story.extend(
        job(
            "Farmart",
            "May 2023 - Present",
            [("Data Scientist I", "Oct 2024 - Present"), ("Associate Data Scientist", "May 2023 - Oct 2024")],
            [
                "Architected and shipped a modular document AI review platform processing approximately <b>500 documents/day</b>, combining multimodal classification and extraction, configurable business rules, ML validators, and human-in-the-loop checkpoints.",
                "Raised automated coverage from <b>0% to 60%+</b> on the primary document pipeline, reaching <b>70% in active flows</b>, and achieved approximately <b>30% automation</b> on a second document type while retaining reviewable decisions and exception handling.",
                "Designed production multimodal agent workflows across product and messaging channels, supporting text, image, document, and voice inputs with retrieval-augmented context, streaming responses, tool calling, and authenticated downstream actions.",
                "Engineered the agent execution layer for query routing, multi-agent orchestration, chat and session state, persistent memory, media ingestion, tool invocation, and integration with operational APIs.",
                "Built a retrieval-augmented content automation pipeline spanning source discovery, ingestion, relevance scoring, LLM metadata tagging, DSPy-driven draft generation, AI-assisted editing, and human review; increased peak throughput from <b>6-8 to 14-15 articles/day</b>.",
            ],
            styles,
        )
    )

    story.append(PageBreak())
    story.extend(
        job(
            "Farmart (continued)",
            "May 2023 - Present",
            [],
            [
                "Developed computer vision systems for quality assessment across <b>2 commodity categories</b> using SAM segmentation, DenseNet classifiers, and contrastive representation learning; achieved <b>85%+ sample-weighted accuracy</b> and reduced buyer-retailer deduction disputes by <b>14%</b>.",
                "Built label-efficient image and text classification workflows using CLIP, sentence transformers, contrastive learning, and SetFit-style fine-tuning; reached approximately <b>80% accuracy</b> in selected moderation and compliance use cases with as few as <b>100 labels per class</b>.",
                "Developed commodity price forecasting experiments over sparse multi-source market data using web scraping, feature engineering, linear regression, random forests, and gradient-boosted trees; achieved <b>1.3% MAPE for 7-day</b> and <b>2.8% MAPE for 30-day</b> evaluation horizons.",
                "Built and maintained internal AI and data tooling with Python and FastAPI, Celery/SQS worker pipelines, scheduled jobs, review queues, and dashboards across AWS and GCP, backed by PostgreSQL, MongoDB, Redis, MySQL, and Databricks with CI/CD, logging, and monitoring.",
            ],
            styles,
        )
    )

    story.extend(
        job(
            "Farmart",
            "Feb 2023 - May 2023",
            [("Data Science Intern", "")],
            ["Fine-tuned and deployed a visual question answering model for multi-field document extraction, owning dataset creation, model training, API deployment, and post-launch monitoring from initial prototype through the first production version."],
            styles,
        )
    )
    story.extend(
        job(
            "Scaler",
            "Dec 2022 - Feb 2023",
            [("Product Analyst Intern", "")],
            ["Reviewed and developed data science, machine learning, and deep learning educational content and researched topics for new technical articles."],
            styles,
        )
    )
    story.extend(
        job(
            "Doubtnut",
            "May 2022 - Nov 2022",
            [("Machine Learning Engineer Intern", "")],
            [
                "Trained and deployed a deep learning classifier for Hinglish profanity detection in user-generated content, achieving <b>90%+ accuracy</b> and <b>0.84 F1</b> on offline evaluation.",
                "Implemented Whisper-based transcription and translation pipelines for short- and long-form video content, and prototyped a geospatial clustering-based recommendation system.",
            ],
            styles,
        )
    )

    story += section("Education", styles)
    story.append(two_column("<b>Delhi Technological University, Delhi</b><br/>B.Tech. in Electrical Engineering | GPA: 7.8/10", "2019 - 2023", styles["education"], styles["date"]))

    story += section("Leadership", styles)
    story.append(
        two_column(
            "<b>Unmanned Ground Vehicles, DTU</b> | <i>Corporate Head</i><br/>Led corporate affairs across a 30-member student engineering team and raised INR 400,000 for its IGVC vehicle project.",
            "2021 - 2023",
            styles["education"],
            styles["date"],
        )
    )

    document.build(story, onFirstPage=draw_page_number, onLaterPages=draw_page_number)
    print(OUTPUT)


if __name__ == "__main__":
    build()
