import modal
import requests
import os

app = modal.App("wedding-rsvp")

image = modal.Image.debian_slim().pip_install("fastapi", "requests")

secrets = modal.Secret.from_name("airtable")

AIRTABLE_URL = "https://api.airtable.com/v0"


def airtable_get(base, table, formula):
	url = f"{AIRTABLE_URL}/{base}/{table}"
	headers = {
		"Authorization": f"Bearer {os.environ['AIRTABLE_TOKEN']}"
	}
	params = {"filterByFormula": formula}
	r = requests.get(url, headers=headers, params=params)
	r.raise_for_status()
	return r.json()["records"]


@app.function(image=image, secrets=[secrets])
@modal.fastapi_endpoint(method="GET")
def lookup(name: str):
	name = name.lower().strip()
	if not name:
		return {"error": "missing name"}

	base = os.environ["AIRTABLE_BASE"]

	# Party
	parties = airtable_get(
		base,
		"Parties",
		f"{{lookup_key}}='{name}'"
	)

	if not parties:
		return {"error": "party not found"}

	party = parties[0]
	party_id = party["id"]

	# Guests (linked record lookup)
	guests = airtable_get(
		base,
		"Guests",
		f"FIND('{party_id}', ARRAYJOIN({{party}}))"
	)

	guest_ids = [g["id"] for g in guests]

	# Invitations
	inv_formula = "OR(" + ",".join(
		f"FIND('{gid}', ARRAYJOIN({{guest}}))" for gid in guest_ids
	) + ")"

	invitations = airtable_get(
		base,
		"Invitations",
		inv_formula
	)

	event_ids = list(set([event_id for i in invitations for event_id in i["fields"]["event"]]))
	print(event_ids)

	# Events
	event_formula = "OR(" + ",".join(
		f"RECORD_ID()='{eid}'" for eid in event_ids
	) + ")"

	events = airtable_get(
		base,
		"Events",
		event_formula
	)
	print(events)

	# RSVPs
	rsvps = airtable_get(
		base,
		"RSVPs",
		inv_formula
	)

	# Shape response
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
				"attending": rsvp["fields"].get("attending") if rsvp else None,
				"meal": rsvp["fields"].get("meal_choice") if rsvp else None
			})

		response["events"].append(event_block)

	return response


@app.function(image=image, secrets=[secrets])
@modal.fastapi_endpoint(method="POST")
def submit_rsvp(payload: dict):
    """
    payload = {
        "guestId": "recXXXX",
        "eventId": "recYYYY",
        "attending": True,
        "meal_choice": "Chicken"
    }
    """

    base = os.environ["AIRTABLE_BASE"]

    guest_id = payload.get("guestId")
    event_id = payload.get("eventId")
    attending = payload.get("attending")
    meal_choice = payload.get("meal_choice")

    if not guest_id or not event_id:
        return {"error": "guestId and eventId required"}

    # 1️⃣ Verify invitation exists
    inv_formula = f"AND(FIND('{guest_id}', ARRAYJOIN({{guest}})), FIND('{event_id}', ARRAYJOIN({{event}})))"
    invitations = airtable_get(base, "Invitations", inv_formula)
    if not invitations:
        return {"error": "guest not invited to this event"}

    # 2️⃣ Check if RSVP exists
    rsvp_formula = f"AND(FIND('{guest_id}', ARRAYJOIN({{guest}})), FIND('{event_id}', ARRAYJOIN({{event}})))"
    existing_rsvps = airtable_get(base, "RSVPs", rsvp_formula)

    if existing_rsvps:
        # Update existing RSVP
        rsvp_id = existing_rsvps[0]["id"]
        url = f"{AIRTABLE_URL}/{base}/RSVPs/{rsvp_id}"
        data = {"fields": {"attending": attending, "meal_choice": meal_choice}}
        r = requests.patch(url, headers={"Authorization": f"Bearer {os.environ['AIRTABLE_TOKEN']}", "Content-Type": "application/json"}, json=data)
        r.raise_for_status()
        return {"status": "updated"}
    else:
        # Create new RSVP
        url = f"{AIRTABLE_URL}/{base}/RSVPs"
        data = {"fields": {"guest": [guest_id], "event": [event_id], "attending": attending, "meal_choice": meal_choice}}
        r = requests.post(url, headers={"Authorization": f"Bearer {os.environ['AIRTABLE_TOKEN']}", "Content-Type": "application/json"}, json=data)
        r.raise_for_status()
        return {"status": "created"}
