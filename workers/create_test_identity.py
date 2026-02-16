"""
Create a test identity with 3 angle views for pipeline testing.
Uses raw HTTP calls to avoid supabase-py import issues.
"""
import os
import sys
import json

# Load env
env_paths = [
    os.path.join(os.path.dirname(__file__), '.env'),
    os.path.join(os.path.dirname(__file__), '..', '.env'),
    os.path.join(os.path.dirname(__file__), '..', '.env.local'),
    os.path.join(os.path.dirname(__file__), '..', 'web', '.env.local'),
]
for p in env_paths:
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("Error: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

REST_URL = f"{SUPABASE_URL}/rest/v1"
AUTH_URL = f"{SUPABASE_URL}/auth/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

TEST_IMG = "https://storage.googleapis.com/falserverless/example_inputs/model.png"

# Use urllib from stdlib (no conflict with workers/queue.py when using urllib.request)
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def api_call(method, path, body=None, base=None):
    """Make a raw HTTP call to Supabase."""
    url = f"{base or REST_URL}/{path}"
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")
        raise

def main():
    # 1. Get first user via Auth Admin API
    print("Fetching users...")
    users = api_call("GET", "admin/users?page=1&per_page=1", base=AUTH_URL)
    user_list = users.get("users", [])
    if not user_list:
        print("No users found. Create one via /login first.")
        sys.exit(1)

    user = user_list[0]
    user_id = user["id"]
    email = user.get("email", "unknown")
    print(f"  User: {email} ({user_id})")

    # 2. Create identity
    print("Creating identity...")
    identities = api_call("POST", "identities", {
        "user_id": user_id,
        "raw_selfie_url": TEST_IMG,
        "master_identity_url": TEST_IMG,
        "status": "ready",
        "onboarding_mode": "ai_director"
    })
    identity_id = identities[0]["id"]
    print(f"  Identity ID: {identity_id}")

    # 3. Create 3 identity views
    print("Creating identity views...")
    views = api_call("POST", "identity_views", [
        {"identity_id": identity_id, "angle": "front",         "image_url": TEST_IMG, "status": "validated", "source": "upload"},
        {"identity_id": identity_id, "angle": "profile",       "image_url": TEST_IMG, "status": "validated", "source": "upload"},
        {"identity_id": identity_id, "angle": "three_quarter", "image_url": TEST_IMG, "status": "validated", "source": "upload"},
    ])
    print(f"  Created {len(views)} views")

    print(f"\n✅ Test identity ready!")
    print(f"   User:     {email}")
    print(f"   Identity: {identity_id}")
    print(f"   Image:    {TEST_IMG}")

if __name__ == "__main__":
    main()
