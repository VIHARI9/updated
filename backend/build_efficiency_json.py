from app.efficiency_service import build_efficiency_json

if __name__ == "__main__":
    payload = build_efficiency_json(force=True)
    print(f"Created sap_efficiency_daily.json with {len(payload['daily'])} daily records")
