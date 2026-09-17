#!/usr/bin/env python3
"""
Single-command runner for the Oldsmar SCADA Safety Interlock Demo System.
Starts the FastAPI backend, static file server, SQLite audit sink, and 1Hz physical simulation.
"""

import argparse
import os
import sys
import uvicorn


def print_banner(host: str, port: int):
    print("=" * 80)
    print("  OLDSMAR WATER TREATMENT PLANT // SCADA CHEMICAL DOSING INTERLOCK")
    print("  Cyber-Physical Demonstration System (2021 Oldsmar Attack Defense)")
    print("=" * 80)
    print(f"  * Control Room Console Dashboard: http://localhost:{port}/")
    print(f"  * REST API & Telemetry Endpoint:  http://localhost:{port}/state")
    print(f"  * Interactive OpenAPI Swagger:   http://localhost:{port}/docs")
    print("-" * 80)
    print("  DEMO ATTACK VECTORS:")
    print(f"  1. Oldsmar Spike (11,100 ppm):   bash scripts/attack_oldsmar.sh {port}")
    print(f"  2. Single-Channel Stealth:       bash scripts/attack_stealth.sh {port}")
    print(f"  3. Slow Ramp Dual Compromise:    bash scripts/attack_slow_ramp.sh {port}")
    print(f"  4. Flow Sensor Falsification:    bash scripts/attack_flow.sh {port}")
    print(f"  5. Reset System Simulation:      bash scripts/reset.sh {port}")
    print(f"  6. Python Adversarial Harness:   python scripts/attacks.py")
    print("=" * 80)
    print("  Press Ctrl+C to terminate cleanly.\n")


def main():
    parser = argparse.ArgumentParser(description="Start Oldsmar SCADA Interlock Demo")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reloading for development")
    args = parser.parse_args()

    print_banner(args.host, args.port)

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )


if __name__ == "__main__":
    main()
