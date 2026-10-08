from fastapi import FastAPI, Header, Query
from typing import Optional
from app.canvas_service import get_assignments
from app.scoring_engine import calculate_priority_score

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Canvas Focus API is running!"}

@app.get("/api/assignments")
def fetch_assignments(ics_url: Optional[str] = Query(None)):
    # ... fetch assignments from Canvas API or .ics feed ...
    assignments = get_assignments(user_ics_url=ics_url)
    for assignment in assignments:
        assignment["priority_score"] = calculate_priority_score(
            assignment,
            group_weight=assignment.get("group_weight", 1.0),
            user_offset=assignment.get("user_offset", 0)
        )
    assignments.sort(key=lambda x: x["priority_score"], reverse=True)
    return {"status": "success", "data": assignments}