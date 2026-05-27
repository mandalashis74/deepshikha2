import requests

url = "https://xkpqkbberckxblkhseim.supabase.co/rest/v1/tickets?limit=1"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",
    "Prefer": "count=exact"
}

r = requests.options(url, headers=headers)
print("Status:", r.status_code)
print("Allow:", r.headers.get("Allow"))
print("Content-Type:", r.headers.get("Content-Type"))
# Let's request schema info if possible via OpenAPI description
r2 = requests.get("https://xkpqkbberckxblkhseim.supabase.co/rest/v1/", headers=headers)
import json
try:
    swagger = r2.json()
    tickets_definition = swagger.get("definitions", {}).get("tickets", {})
    print("Tickets Table Columns:", list(tickets_definition.get("properties", {}).keys()))
    comments_definition = swagger.get("definitions", {}).get("ticket_comments", {})
    print("Comments Table Columns:", list(comments_definition.get("properties", {}).keys()))
except Exception as e:
    print("Error reading schema info:", e)
