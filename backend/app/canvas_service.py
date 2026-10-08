import requests
import os
import re
from datetime import datetime, timezone
from icalendar import Calendar

# Paste your Canvas Calendar Feed URL here (or set it as an environment variable)
CANVAS_ICS_URL = os.getenv("CANVAS_ICS_URL", "https://byui.instructure.com/feeds/calendars/user_EACLWH4l8VLeDKW5C7BwqhEdwShSYHQDSeMZKwby.ics")

def extract_points_from_text(description, title):
    # Pattern 1: Matches "15 points", "100 pts", "Points Possible: 50"
    match = re.search(r'(?:points\s*possible|pts|points):\s*(\d+(?:\.\d+)?)', description, re.IGNORECASE)
    if match:
        return float(match.group(1))

    # Pattern 2: Matches "15pts" or "20 points" anywhere in description or title
    match_alt = re.search(r'(\d+(?:\.\d+)?)\s*(?:pts|points)', f"{title} {description}", re.IGNORECASE)
    if match_alt:
        return float(match_alt.group(1))

    # Return None if no points are specified in the feed text
    return None

def get_assignments():
    # Fall back to mock data if no feed URL is provided yet
    if CANVAS_ICS_URL == "YOUR_CANVAS_ICAL_URL_HERE":
        base_dir = os.path.dirname(__file__)
        file_path = os.path.join(base_dir, "mock_data.json")
        with open(file_path, "r") as file:
            import json
            return json.load(file)

    try:
        response = requests.get(CANVAS_ICS_URL)
        if response.status_code != 200:
            print(f"Failed to fetch calendar feed: {response.status_code}")
            return []

        cal = Calendar.from_ical(response.content)
        assignments = []
        now = datetime.now(timezone.utc)

        for item in cal.walk('VEVENT'):
            summary = str(item.get('summary', ''))
            description = str(item.get('description', ''))

            # Extract due date
            due_dt = item.get('dtend') or item.get('dtstart')
            due_at_iso = None
            dt_obj = None

            if due_dt:
                dt_obj = due_dt.dt
                # Convert date-only or naive datetime objects to UTC datetime
                if isinstance(dt_obj, datetime):
                    if dt_obj.tzinfo is None:
                        dt_obj = dt_obj.replace(tzinfo=timezone.utc)
                    due_at_iso = dt_obj.isoformat()
                else:
                    due_at_iso = f"{dt_obj.isoformat()}T23:59:59Z"
                    dt_obj = datetime.combine(dt_obj, datetime.max.time()).replace(tzinfo=timezone.utc)

            # Filter out past assignments
            if dt_obj and dt_obj < now:
                continue

            # Attempt to extract points from description or fallback intelligently
            points_match = re.search(r'(\d+)\s*pts|\bpoints:\s*(\d+)', description, re.IGNORECASE)
            if points_match:
                points_possible = int(points_match.group(1) or points_match.group(2))
            else:
                # Default baseline fallback if Canvas feed omits points in text
                title_lower = summary.lower()
                if 'quiz' in title_lower or 'check' in title_lower:
                    points_possible = 10
                elif 'exam' in title_lower or 'project' in title_lower or 'paper' in title_lower:
                    points_possible = 100
                else:
                    points_possible = 25

            # Use UID or generate unique hash ID
            points = extract_points_from_text(description, summary)
            uid = str(item.get('uid', hash(summary)))

            # Only include future/upcoming items
            assignments.append({
                "id": uid,
                "name": summary,
                "due_at": due_at_iso,
                "points_possible": points,
                "description": description
            })
        return assignments

    except Exception as e:
        print(f"Error parsing .ics calendar feed: {e}")
        return []