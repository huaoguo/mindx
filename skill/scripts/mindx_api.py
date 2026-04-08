#!/usr/bin/env python3
"""
MindX API CLI Tool (v4.0.0)

Usage:
    mindx_api.py list [--type TYPE] [--agent_id AID]
    mindx_api.py upload --type TYPE --filename FN --content CT --file_created_at DT
    mindx_api.py get --id ID
    mindx_api.py delete --id ID

API Spec: http://localhost:3000/openapi.json
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse

BASE_URL = os.environ.get("MINDX_BASE_URL", "").rstrip("/")
API_KEY = os.environ.get("MINDX_API_KEY", "")

if not BASE_URL:
    print("Error: MINDX_BASE_URL environment variable is required", file=sys.stderr)
    sys.exit(1)
if not API_KEY:
    print("Error: MINDX_API_KEY environment variable is required", file=sys.stderr)
    sys.exit(1)


def api_request(method, url, data=None):
    """Make an HTTP request and return parsed JSON response."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {"raw_response": raw}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        print(f"Response: {error_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection Error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def pp(obj):
    """Pretty-print JSON."""
    print(json.dumps(obj, indent=2, ensure_ascii=False))


# ── Documents ────────────────────────────────────────────────────────────

def docs_list(args):
    params = {}
    if args.type:
        params["type"] = args.type
    if args.agent_id:
        params["agent_id"] = str(args.agent_id)
    qs = f"?{urllib.parse.urlencode(params)}" if params else ""
    pp(api_request("GET", f"{BASE_URL}/api/documents{qs}"))

def docs_upload(args):
    payload = {
        "type": args.type,
        "filename": args.filename,
        "content": args.content,
        "file_created_at": args.file_created_at,
    }
    pp(api_request("POST", f"{BASE_URL}/api/documents", data=payload))

def docs_get(args):
    pp(api_request("GET", f"{BASE_URL}/api/documents/{args.id}"))

def docs_delete(args):
    pp(api_request("DELETE", f"{BASE_URL}/api/documents/{args.id}"))


# ── Status ──────────────────────────────────────────────────────────────

def set_status(args):
    me = api_request("GET", f"{BASE_URL}/api/agents/me")
    pp(api_request("PUT", f"{BASE_URL}/api/agents/{me['id']}/status", data={"status": args.status}))


# ── CLI ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="MindX API CLI (v4.0.0)")
    subparsers = parser.add_subparsers(dest="action", required=True)

    p = subparsers.add_parser("list", help="List documents")
    p.add_argument("--type", choices=["user", "soul", "memory", "log", "chat"], help="Filter by type")
    p.add_argument("--agent_id", type=int, help="Filter by agent ID")

    p = subparsers.add_parser("upload", help="Upload a markdown document")
    p.add_argument("--type", required=True, choices=["user", "soul", "memory", "log", "chat"], help="Document type")
    p.add_argument("--filename", required=True, help="Filename")
    p.add_argument("--content", required=True, help="Markdown content")
    p.add_argument("--file_created_at", required=True, help="Original file creation time (ISO 8601)")

    p = subparsers.add_parser("get", help="Get a document")
    p.add_argument("--id", required=True, type=int, help="Document ID")

    p = subparsers.add_parser("delete", help="Delete a document")
    p.add_argument("--id", required=True, type=int, help="Document ID")

    p = subparsers.add_parser("set-status", help="Update agent status")
    p.add_argument("--status", required=True, choices=["idle", "installing", "connected"], help="New status")

    args = parser.parse_args()

    dispatch = {
        "list": docs_list,
        "upload": docs_upload,
        "get": docs_get,
        "delete": docs_delete,
        "set-status": set_status,
    }

    handler = dispatch.get(args.action)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
