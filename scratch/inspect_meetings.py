import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Supabase credentials not found in env.")
    exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

res = supabase.table("meetings").select("*").execute()
print("Meetings count:", len(res.data))
for m in res.data:
    print(f"ID: {m['id']} | Title: {m['title']} | Type: {m['type']} | Status: {m['status']} | Minutes URL: {m['minutes_url']}")

res_res = supabase.table("resolutions").select("*").execute()
print("\nResolutions count:", len(res_res.data))
for r in res_res.data:
    print(f"ID: {r['id']} | Meeting ID: {r['meeting_id']} | Title: {r['title']} | Number: {r['resolution_number']}")
