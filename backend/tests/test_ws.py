"""
WebSocket integration test for the MindArmor XAI backend.

Prerequisites:
    pip install websockets

Usage (manual):
    1. Start server:  uvicorn main:app --reload
    2. Run this:      python tests/test_ws.py

Usage (pytest — requires running server):
    pytest tests/test_ws.py -v
"""

from __future__ import annotations

import asyncio
import json
import sys
import os

# Fix Windows console encoding
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

# Ensure backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

WS_URL = "ws://localhost:8000/ws"


async def manual_test() -> None:
    """Manual WebSocket test — sends text and prints streamed responses."""
    try:
        import websockets  # type: ignore[import-untyped]
    except ImportError:
        print("Install websockets: pip install websockets")
        return

    print(f"Connecting to {WS_URL}...")
    async with websockets.connect(WS_URL) as ws:
        # -- Test 1: Manipulative text ----------------------------------------
        test_text = (
            "This DISGUSTING crisis will DESTROY everything we know! "
            "Everyone agrees this is the worst disaster in history. "
            "You either act NOW or you're part of the problem!"
        )
        print(f"\n{'='*60}")
        print(f"SENDING: {test_text[:80]}...")
        print(f"{'='*60}\n")

        await ws.send(json.dumps({"text": test_text}))

        thoughts = 0
        result = None
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                data = json.loads(msg)

                if data["type"] == "thought":
                    thoughts += 1
                    print(f"  [THOUGHT] {data['content']}")
                elif data["type"] == "result":
                    result = data["data"]
                    print(f"\n  [OK] RESULT:")
                    print(f"     Risk Score : {result['risk_score']}")
                    print(f"     Type       : {result['type']}")
                    print(f"     Explanation: {result['explanation'][:120]}...")
                    print(f"     Neutralized: {result['neutralized'][:120]}...")
                    break
                elif data["type"] == "error":
                    print(f"  [ERROR] {data['content']}")
                    break
                elif data["type"] == "info":
                    print(f"  [INFO] {data['content']}")
                    break
            except asyncio.TimeoutError:
                print("  [TIMEOUT] Timeout waiting for response")
                break

        print(f"\n  Total thoughts streamed: {thoughts}")
        assert result is not None, "No result received"
        assert result["risk_score"] > 0.3, f"Expected high risk, got {result['risk_score']}"
        print("  [PASS] Manipulative text test PASSED")

        # -- Test 2: Neutral text ----------------------------------------------
        neutral_text = "The weather is sunny today with a temperature of 72 degrees."
        print(f"\n{'='*60}")
        print(f"SENDING: {neutral_text}")
        print(f"{'='*60}\n")

        await ws.send(json.dumps({"text": neutral_text}))

        result2 = None
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                data = json.loads(msg)
                if data["type"] == "thought":
                    print(f"  [THOUGHT] {data['content']}")
                elif data["type"] == "result":
                    result2 = data["data"]
                    print(f"\n  [OK] RESULT: risk={result2['risk_score']}")
                    break
            except asyncio.TimeoutError:
                break

        assert result2 is not None
        assert result2["risk_score"] < 0.3, f"Expected low risk, got {result2['risk_score']}"
        print("  [PASS] Neutral text test PASSED")

        # -- Test 3: Empty text ------------------------------------------------
        print(f"\n{'='*60}")
        print("SENDING: (empty text)")
        print(f"{'='*60}\n")

        await ws.send(json.dumps({"text": ""}))
        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(msg)
        assert data["type"] == "info", f"Expected info, got {data['type']}"
        print(f"  [INFO] {data['content']}")
        print("  [PASS] Empty text test PASSED")

    print(f"\n{'='*60}")
    print("All WebSocket tests PASSED")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(manual_test())
