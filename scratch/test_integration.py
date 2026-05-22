import urllib.request
import json

BASE_URL = "http://127.0.0.1:5000"

def test_add_income():
    print("Testing /api/income (POST)...")
    url = f"{BASE_URL}/api/income"
    data = {
        "flat_no": "2B - Test Owner",
        "year": "2026",
        "month": "May",
        "amount": "1500.50",
        "date": "2026-05-22"
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as res:
            body = json.loads(res.read().decode('utf-8'))
            print("Response:", body)
            assert body["status"] == "success"
            assert "id" in body
            return body["id"]
    except Exception as e:
        print("Failed to add income:", e)
        raise

def test_get_receipt(entry_id):
    print(f"Testing /api/receipt/{entry_id} (GET)...")
    url = f"{BASE_URL}/api/receipt/{entry_id}"
    try:
        with urllib.request.urlopen(url) as res:
            content_type = res.headers.get('Content-Type')
            print("Content-Type:", content_type)
            assert content_type == 'application/pdf'
            pdf_bytes = res.read()
            print(f"PDF bytes received: {len(pdf_bytes)}")
            assert len(pdf_bytes) > 1000
    except Exception as e:
        print("Failed to get receipt PDF:", e)
        raise

def test_history(entry_id):
    print("Testing /api/history (GET) with flat_no filter...")
    url = f"{BASE_URL}/api/history?flat_no=2B&year=2026&month=May"
    try:
        with urllib.request.urlopen(url) as res:
            entries = json.loads(res.read().decode('utf-8'))
            print(f"Found {len(entries)} matching history entries without search query")
            found = False
            for entry in entries:
                if entry["id"] == entry_id:
                    print("Found test entry:", entry)
                    assert entry["flat_no"] == "2B"
                    assert entry["amount"] == 1500.50
                    assert entry["type"] == "INCOME"
                    found = True
            assert found, "Test entry not found in history"
    except Exception as e:
        print("Failed to search history:", e)
        raise

    print("Testing /api/history (GET) with search query '1500'...")
    url = f"{BASE_URL}/api/history?search=1500"
    try:
        with urllib.request.urlopen(url) as res:
            entries = json.loads(res.read().decode('utf-8'))
            print(f"Found {len(entries)} matching history entries for search '1500'")
            found = False
            for entry in entries:
                if entry["id"] == entry_id:
                    found = True
            assert found, "Test entry not found in history with search '1500'"
    except Exception as e:
        print("Failed to search history by amount query:", e)
        raise

def test_delete(entry_id):
    print(f"Testing /api/entry/INCOME/{entry_id} (DELETE)...")
    url = f"{BASE_URL}/api/entry/INCOME/{entry_id}"
    req = urllib.request.Request(url, method='DELETE')
    try:
        with urllib.request.urlopen(req) as res:
            body = json.loads(res.read().decode('utf-8'))
            print("Response:", body)
            assert body["status"] == "success"
    except Exception as e:
        print("Failed to delete entry:", e)
        raise

if __name__ == "__main__":
    try:
        entry_id = test_add_income()
        test_get_receipt(entry_id)
        test_history(entry_id)
        test_delete(entry_id)
        print("All integration tests PASSED successfully!")
    except Exception as e:
        print("Integration tests FAILED:", e)
        exit(1)
