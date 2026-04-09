#!/usr/bin/env python3
"""
MindX API CLI Tool (v4.0.0)

Usage:
    mindx_api.py init --base_url URL --api_key KEY
    mindx_api.py list [--type TYPE] [--agent_id AID]
    mindx_api.py upload --type TYPE --filename FN --content CT --file_created_at DT
    mindx_api.py get --id ID
    mindx_api.py delete --id ID
    mindx_api.py set-status --status STATUS
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse

# ── Config ──────────────────────────────────────────────────────────────

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')


def load_config():
    """Load config from config.json, env vars take precedence."""
    config = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            config = json.load(f)
    base_url = os.environ.get("MINDX_BASE_URL", config.get("base_url", "")).rstrip("/")
    api_key = os.environ.get("MINDX_API_KEY", config.get("api_key", ""))
    return base_url, api_key


def require_config():
    """Load config and exit if missing."""
    base_url, api_key = load_config()
    if not base_url:
        print("Error: MINDX_BASE_URL not set. Run 'init' first or set the environment variable.", file=sys.stderr)
        sys.exit(1)
    if not api_key:
        print("Error: MINDX_API_KEY not set. Run 'init' first or set the environment variable.", file=sys.stderr)
        sys.exit(1)
    return base_url, api_key


BASE_URL = ""
API_KEY = ""


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


# ── Init ────────────────────────────────────────────────────────────────

def do_init(args):
    cfg = {"base_url": args.base_url.rstrip("/"), "api_key": args.api_key}
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, 'w') as f:
        json.dump(cfg, f, indent=2)
    print(f"Config saved to {CONFIG_PATH}")


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

def docs_upload_file(args):
    """Upload a document from a local file."""
    file_path = args.file
    if not os.path.exists(file_path):
        print(f"Error: file not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    filename = args.filename or os.path.basename(file_path)
    boundary = "----MindXBoundary" + os.urandom(8).hex()

    # Build multipart body
    parts = []
    for key, val in [("type", args.type), ("file_created_at", args.file_created_at)]:
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{val}".encode())
    if args.filename:
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"filename\"\r\n\r\n{args.filename}".encode())

    with open(file_path, "rb") as f:
        file_data = f.read()
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: text/markdown\r\n\r\n".encode()
        + file_data
    )
    body = b"\r\n".join(parts) + f"\r\n--{boundary}--\r\n".encode()

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {API_KEY}",
    }
    req = urllib.request.Request(f"{BASE_URL}/api/documents/upload", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            pp(json.loads(resp.read().decode("utf-8")))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        print(f"Response: {error_body}", file=sys.stderr)
        sys.exit(1)

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
    global BASE_URL, API_KEY

    parser = argparse.ArgumentParser(description="MindX API CLI (v4.0.0)")
    subparsers = parser.add_subparsers(dest="action", required=True)

    p = subparsers.add_parser("init", help="Save config (base_url, api_key) to config.json")
    p.add_argument("--base_url", required=True, help="MindX server URL")
    p.add_argument("--api_key", required=True, help="Agent API key")

    p = subparsers.add_parser("list", help="List documents")
    p.add_argument("--type", choices=["user", "soul", "memory", "log", "chat"], help="Filter by type")
    p.add_argument("--agent_id", type=int, help="Filter by agent ID")

    p = subparsers.add_parser("upload", help="Upload a markdown document (JSON body)")
    p.add_argument("--type", required=True, choices=["user", "soul", "memory", "log", "chat"], help="Document type")
    p.add_argument("--filename", required=True, help="Filename")
    p.add_argument("--content", required=True, help="Markdown content")
    p.add_argument("--file_created_at", required=True, help="Original file creation time (ISO 8601)")

    p = subparsers.add_parser("upload-file", help="Upload a local markdown file")
    p.add_argument("--type", required=True, choices=["user", "soul", "memory", "log", "chat"], help="Document type")
    p.add_argument("--file", required=True, help="Path to the local file")
    p.add_argument("--filename", help="Override filename (defaults to the file's basename)")
    p.add_argument("--file_created_at", required=True, help="Original file creation time (ISO 8601)")

    p = subparsers.add_parser("get", help="Get a document")
    p.add_argument("--id", required=True, type=int, help="Document ID")

    p = subparsers.add_parser("delete", help="Delete a document")
    p.add_argument("--id", required=True, type=int, help="Document ID")

    p = subparsers.add_parser("set-status", help="Update agent status")
    p.add_argument("--status", required=True, choices=["idle", "installing", "connected"], help="New status")

    args = parser.parse_args()

    # init doesn't need config loaded
    if args.action == "init":
        do_init(args)
        return

    # All other commands need config
    BASE_URL, API_KEY = require_config()

    dispatch = {
        "list": docs_list,
        "upload": docs_upload,
        "upload-file": docs_upload_file,
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
