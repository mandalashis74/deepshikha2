import requests

url = "https://xkpqkbberckxblkhseim.supabase.co/rest/v1/owners"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE",
    "Content-Type": "application/json"
}

# Seed default flat list A1-H8
default_owners = []
floors = ['1','2','3','4','5','6','7','8']
wings = ['A','B','C','D','E','F','G','H']

for f in floors:
    for w in wings:
        flat_no = f"{f}{w}"
        owner_name = f"Owner {flat_no}"
        
        # Give Flat 1A a test contact and birth year for verification testing
        contact_no = "9876543210" if flat_no == "1A" else ""
        birth_year = 1990 if flat_no == "1A" else None
        
        default_owners.append({
            "flat_no": flat_no,
            "owner_name": owner_name,
            "contact_no": contact_no,
            "birth_year": birth_year,
            "occupancy_status": "owner-occupied",
            "monthly_mc_rate": 1000.00
        })

# Perform upsert
r = requests.post(url, headers=headers, json=default_owners)
print("Status:", r.status_code)
print("Response:", r.text)
