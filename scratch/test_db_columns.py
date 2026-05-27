import requests

url = "https://xkpqkbberckxblkhseim.supabase.co/rest/v1/tickets"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Try inserting a ticket with all new fields to see what columns fail
data = {
    "title": "Test Title",
    "description": "Test Description",
    "priority": "High",
    "archived": False,
    "attachments": [],
    "assigned_to": None,
    "ticket_number": "TKT-2026-999"
}

r = requests.post(url, headers=headers, json=data)
print("Status:", r.status_code)
print("Response:", r.text)
