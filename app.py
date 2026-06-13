import modal
import requests
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import fastapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = modal.App("wedding-rsvp")

SITE_DIR = Path(__file__).parent

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi", "requests")
    .add_local_dir(
        SITE_DIR,
        remote_path="/site",
        ignore=[
            "*.py",
            "__pycache__",
            ".git",
            "test",
            "test.html",
            ".gitignore",
            "airtable.pat.txt",
            "CNAME",
            "robots.txt",
            "scripts",
        ],
    )
)

secrets = modal.Secret.from_name("airtable")

AIRTABLE_URL = "https://api.airtable.com/v0"

_cache = {}
_cache_ttl = 30


def _get_cache_key(base, table, formula):
    return f"{base}:{table}:{formula}"


def _is_cache_valid(cache_entry):
    return time.time() - cache_entry["timestamp"] < _cache_ttl


def airtable_get(base, table, formula, use_cache=True):
    if use_cache:
        cache_key = _get_cache_key(base, table, formula)
        if cache_key in _cache and _is_cache_valid(_cache[cache_key]):
            return _cache[cache_key]["data"]

    url = f"{AIRTABLE_URL}/{base}/{table}"
    headers = {
        "Authorization": f"Bearer {os.environ['AIRTABLE_TOKEN']}"
    }
    params = {"filterByFormula": formula}
    r = requests.get(url, headers=headers, params=params)
    r.raise_for_status()
    records = r.json()["records"]

    if use_cache:
        cache_key = _get_cache_key(base, table, formula)
        _cache[cache_key] = {
            "data": records,
            "timestamp": time.time()
        }

    return records


def do_lookup(name: str):
    name = name.strip()
    if not name:
        return {"error": "missing name"}

    base = os.environ["AIRTABLE_BASE"]

    name_lower = name.lower()
    guests = airtable_get(
        base,
        "Guests",
        f"LOWER({{display_name}}) = '{name_lower}'"
    )

    if not guests:
        guests_partial = airtable_get(
            base,
            "Guests",
            f"FIND('{name_lower}', LOWER({{display_name}}))",
            use_cache=False
        )

        if guests_partial:
            return {"error": "RSVP not found - please enter your full name. In case of issues, contact us at obrionthakkar@gmail.com"}

        return {"error": "party not found"}

    guest = guests[0]
    if "party" not in guest["fields"] or not guest["fields"]["party"]:
        return {"error": "guest has no party"}

    party_id = guest["fields"]["party"][0]

    def fetch_party():
        return airtable_get(
            base,
            "Parties",
            f"RECORD_ID()='{party_id}'"
        )

    def fetch_guests():
        return airtable_get(
            base,
            "Guests",
            f"FIND('{party_id}', ARRAYJOIN({{party}}))"
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        party_future = executor.submit(fetch_party)
        guests_future = executor.submit(fetch_guests)
        party_records = party_future.result()
        guests = guests_future.result()

    if not party_records:
        return {"error": "party not found"}

    party = party_records[0]
    party_id = party["id"]

    if not guests:
        return {"error": "no guests found for party"}

    guest_ids = [g["id"] for g in guests]

    if not guest_ids:
        return {
            "party": {
                "id": party_id,
                "name": party["fields"]["display_name"]
            },
            "events": []
        }

    inv_formula = "OR(" + ",".join(
        f"FIND('{gid}', ARRAYJOIN({{guest}}))" for gid in guest_ids
    ) + ")"

    invitations = airtable_get(
        base,
        "Invitations",
        inv_formula
    )

    if not invitations:
        return {
            "party": {
                "id": party_id,
                "name": party["fields"]["display_name"]
            },
            "events": []
        }

    event_ids = list(set([event_id for i in invitations for event_id in i["fields"]["event"]]))

    if not event_ids:
        return {
            "party": {
                "id": party_id,
                "name": party["fields"]["display_name"]
            },
            "events": []
        }

    event_formula = "OR(" + ",".join(
        f"RECORD_ID()='{eid}'" for eid in event_ids
    ) + ")"

    def fetch_events():
        return airtable_get(base, "Events", event_formula)

    def fetch_rsvps():
        return airtable_get(base, "RSVPs", inv_formula)

    with ThreadPoolExecutor(max_workers=2) as executor:
        events_future = executor.submit(fetch_events)
        rsvps_future = executor.submit(fetch_rsvps)
        events = events_future.result()
        rsvps = rsvps_future.result()

    response = {
        "party": {
            "id": party_id,
            "name": party["fields"]["display_name"]
        },
        "events": []
    }

    for event in sorted(events, key=lambda e: e["fields"].get("sort_order", 0)):
        event_id = event["id"]

        invited_guests = [
            guest_id
            for i in invitations
            if "event" in i["fields"] and i["fields"]["event"]
            for eid in i["fields"]["event"]
            if eid == event_id
            for guest_id in i["fields"]["guest"]
        ]
        invited_guests = list(set(invited_guests))

        event_block = {
            "eventId": event_id,
            "name": event["fields"]["name"],
            "requiresMeal": event["fields"].get("requires_meal", False),
            "guests": []
        }

        for g in guests:
            if g["id"] not in invited_guests:
                continue

            rsvp = next(
                (
                    r for r in rsvps
                    if r["fields"]["guest"][0] == g["id"]
                    and r["fields"]["event"][0] == event_id
                ),
                None
            )

            event_block["guests"].append({
                "guestId": g["id"],
                "name": g["fields"]["display_name"],
                "isChild": bool(g["fields"].get("is_child")),
                "attending": rsvp["fields"].get("attending") if rsvp else None,
                "meal": rsvp["fields"].get("meal_choice") if rsvp else None,
                "kidChoice": rsvp["fields"].get("kid_choice") if rsvp else None
            })

        response["events"].append(event_block)

    return response


def do_submit_rsvp(payload: dict):
    base = os.environ["AIRTABLE_BASE"]

    guest_id = payload.get("guestId")
    event_id = payload.get("eventId")
    attending = payload.get("attending")
    meal_choice = payload.get("meal_choice")
    kid_choice = payload.get("kid_choice")

    if not guest_id or not event_id:
        return {"error": "guestId and eventId required"}

    inv_formula = f"AND(FIND('{guest_id}', ARRAYJOIN({{guest}})), FIND('{event_id}', ARRAYJOIN({{event}})))"
    invitations = airtable_get(base, "Invitations", inv_formula)
    if not invitations:
        return {"error": "guest not invited to this event"}

    rsvp_formula = f"AND(FIND('{guest_id}', ARRAYJOIN({{guest}})), FIND('{event_id}', ARRAYJOIN({{event}})))"
    existing_rsvps = airtable_get(base, "RSVPs", rsvp_formula)

    attending_str = "Yes" if attending else "No"
    fields = {"attending": attending_str, "meal_choice": meal_choice}
    if "kid_choice" in payload:
        fields["kid_choice"] = kid_choice

    if existing_rsvps:
        rsvp_id = existing_rsvps[0]["id"]
        url = f"{AIRTABLE_URL}/{base}/RSVPs/{rsvp_id}"
        data = {"fields": fields}
        r = requests.patch(url, headers={"Authorization": f"Bearer {os.environ['AIRTABLE_TOKEN']}", "Content-Type": "application/json"}, json=data)
        r.raise_for_status()
        _cache.clear()
        return {"status": "updated"}

    url = f"{AIRTABLE_URL}/{base}/RSVPs"
    data = {"fields": {"guest": [guest_id], "event": [event_id], **fields}}
    r = requests.post(url, headers={"Authorization": f"Bearer {os.environ['AIRTABLE_TOKEN']}", "Content-Type": "application/json"}, json=data)
    r.raise_for_status()
    _cache.clear()
    return {"status": "created"}


web_app = fastapi.FastAPI()

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.devangthakkar.com",
        "https://devangthakkar.com",
        "https://www.devangandcarrington.com",
        "https://devangandcarrington.com",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@web_app.get("/lookup")
def lookup(name: str):
    return do_lookup(name)


@web_app.get("/api/lookup")
def lookup_api(name: str):
    return do_lookup(name)


@web_app.post("/submit-rsvp")
def submit_rsvp(payload: dict):
    if payload.get("heartbeat"):
        return {"status": "ok"}
    return do_submit_rsvp(payload)


@web_app.post("/api/submit-rsvp")
def submit_rsvp_api(payload: dict):
    if payload.get("heartbeat"):
        return {"status": "ok"}
    return do_submit_rsvp(payload)


@web_app.get("/api/health")
def health():
    return {"status": "ok"}


@app.function(image=image, secrets=[secrets], scaledown_window=3600, min_containers=1)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def web():
    # Mount static files inside the container (/site exists only on Modal)
    if not any(getattr(route, "name", None) == "site" for route in web_app.routes):
        web_app.mount("/", StaticFiles(directory="/site", html=True), name="site")
    return web_app
