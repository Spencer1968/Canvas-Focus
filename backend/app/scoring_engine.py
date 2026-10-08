import re
from datetime import datetime, timezone

sample_exam = {
    "name": "Final Exam",
    "due_at": "2026-10-09T23:59:59Z",
    "points_possible": 100,
    "description": "Comprehensive final exam covering all modules."
}

sample_quiz = {
    "name": "Chapter 3 Reading Quiz",
    "due_at": "2026-10-07T23:59:59Z",
    "points_possible": 10,
    "description": "5 question check-in."
}

HIGH_PRIORITY_KEYWORDS = {
    'final': 20,
    'exam': 20,
    'midterm': 15,
    'project': 15,
    'essay': 12,
    'paper': 10,
    'presentation': 10,
    'quiz': 8,
    'lab': 8,
    'discussion': 5,
}

def calculate_priority_score(assignment: dict, group_weight: float = 1.0, user_offset: int = 0) -> float:
    score = 0.0
    now = datetime.now(timezone.utc)

    # 1. Urgency Score (Based on days remaining)
    due_at_str = assignment.get("due_at")
    if due_at_str:
        due_at = datetime.fromisoformat(due_at_str.replace("Z", "+00:00"))
        hours_left = (due_at - now).total_seconds() / 3600.0

        if hours_left <= 24:
            urgency = 45.0
        elif hours_left <= 72:
            urgency = 35.0
        elif hours_left <= 168:
            urgency = 25.0
        else:
            urgency = 15.0

        score += urgency

    # 2. Impact & Weight (Points * Category Weight)
    points = assignment.get("points_possible")
    title_lower = (assignment.get("name") or "").lower()

    if points is None:
        if any(k in title_lower for k in ['exam', 'test', 'midterm', 'final', 'project', 'paper']):
            points = 100.0
        elif any(k in title_lower for k in ['quiz', 'lab', 'essay']):
            points = 50.0
        else:
            points = 25.0

    impact = min(points * 0.3, 30.0) * group_weight
    score += impact

    # 3. Keyword Detection in Title/Description
    title = (assignment.get("name") or "").lower()
    description = (assignment.get("description") or "").lower()
    text_to_search = f"{title} {description}"

    keyword_boost = 0
    for keyword, boost in HIGH_PRIORITY_KEYWORDS.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', text_to_search):
            keyword_boost = max(keyword_boost, boost)
    
    score += keyword_boost

    # 4. Manual User Offset
    score += user_offset

    return round(score, 1)

print("Exam Score:", calculate_priority_score(sample_exam, group_weight=1.5))
print("Quiz Score:", calculate_priority_score(sample_quiz, group_weight=1.0))

def process_assignments(assignments):
    # Calculate score for each assignment and sort by highest priority
    for item in assignments:
        item["priority_score"] = calculate_priority_score(item)

    # Sort array in place from highest score to lowest
    assignments.sort(key=lambda x: x["priority_score"], reverse=True)
    return assignments