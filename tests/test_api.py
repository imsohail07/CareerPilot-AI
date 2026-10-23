import json
from fastapi.testclient import TestClient
import app.main as main

client = TestClient(main.app)

def test_health_reports_ai_disabled_by_default(monkeypatch):
    monkeypatch.setattr(main, "GEMINI_API_KEY", "")
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["ai_enabled"] is False

def test_analyze_rule_based_returns_agent_trace(monkeypatch):
    monkeypatch.setattr(main, "GEMINI_API_KEY", "")
    response = client.post("/api/analyze", json={
        "role": "Junior Data Engineer",
        "resume": "I know Python, SQL, Git, pandas, and problem solving. I built data analysis projects.",
        "job_description": "Required skills: Python, SQL, Spark, Kafka, Airflow, Git and Docker."
    })
    assert response.status_code == 200
    data = response.json()
    assert "python" in [s.lower() for s in data["matched_skills"]]
    assert "spark" in [s.lower() for s in data["skill_gaps"]]
    assert len(data["roadmap"]) >= 1
    assert any("compare_skills" in t["name"] for t in data["agent_trace"])
    assert data["ai_used"] is False

def test_analyze_uses_gemini_when_configured(monkeypatch):
    monkeypatch.setattr(main, "GEMINI_API_KEY", "test-key")
    def fake_ai(role, resume, job, comparison):
        return {
            **comparison,
            "summary": "You have a foundation for the target role.",
            "roadmap": main.create_roadmap(comparison["skill_gaps"], role),
            "interview_questions": main.create_interview_questions(role, comparison["skill_gaps"]),
        }
    monkeypatch.setattr(main, "ai_enrich", fake_ai)
    response = client.post("/api/analyze", json={
        "role": "Backend Engineer",
        "resume": "Python SQL Git and FastAPI experience in student projects.",
        "job_description": "Need Python, SQL, Docker, and REST API."
    })
    assert response.status_code == 200
    assert response.json()["ai_used"] is True

def test_gemini_failure_falls_back(monkeypatch):
    monkeypatch.setattr(main, "GEMINI_API_KEY", "test-key")
    def broken(*args, **kwargs):
        raise RuntimeError("mock failure")
    monkeypatch.setattr(main, "ai_enrich", broken)
    response = client.post("/api/analyze", json={
        "role": "Backend Engineer",
        "resume": "Python SQL Git and FastAPI experience in student projects.",
        "job_description": "Need Python, SQL, Docker, and REST API."
    })
    assert response.status_code == 200
    assert response.json()["ai_used"] is False
    assert any("fallback" in t["name"].lower() for t in response.json()["agent_trace"])

def test_invalid_short_input():
    response = client.post("/api/analyze", json={"role":"Dev","resume":"short","job_description":"also short"})
    assert response.status_code == 422

def test_extract_text_resume():
    response = client.post(
        "/api/extract-resume",
        files={"file": ("resume.txt", b"Python SQL React and data analysis experience.", "text/plain")}
    )
    assert response.status_code == 200
    assert "Python" in response.json()["text"]

def test_reject_unsupported_resume_type():
    response = client.post(
        "/api/extract-resume",
        files={"file": ("resume.docx", b"not a supported type", "application/octet-stream")}
    )
    assert response.status_code == 415
