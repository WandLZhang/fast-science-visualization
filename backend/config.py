"""Configuration for Fast Science Infrastructure Visualizer.

Auto-discovers the entire topology from the Stellar Engine outputs bucket.
The user provides ONE value: OUTPUTS_BUCKET (or --outputs-bucket flag).
Everything else is read from the tfvars JSON files in that bucket.
"""
import os
import sys

from services.tfvars_reader import discover_config
from services.discovery import discover_workload_projects

# ─── Entry Point ─────────────────────────────────────────────────────────────
# The only value the user must provide.
# Convention: {prefix}-prod-iac-core-outputs-0
OUTPUTS_BUCKET = os.environ.get("OUTPUTS_BUCKET", "")

# Support --outputs-bucket flag
for i, arg in enumerate(sys.argv):
    if arg == "--outputs-bucket" and i + 1 < len(sys.argv):
        OUTPUTS_BUCKET = sys.argv[i + 1]

if not OUTPUTS_BUCKET:
    print("ERROR: Set OUTPUTS_BUCKET environment variable or pass --outputs-bucket flag")
    print("  export OUTPUTS_BUCKET='<prefix>-prod-iac-core-outputs-0'")
    print("  python main.py --outputs-bucket <prefix>-prod-iac-core-outputs-0")
    sys.exit(1)

# ─── Auto-discover from tfvars ───────────────────────────────────────────────
print(f"[CONFIG] Discovering infrastructure from gs://{OUTPUTS_BUCKET}/...")
_cfg = discover_config(OUTPUTS_BUCKET)

# Core identifiers
PREFIX = _cfg["prefix"]
ORG_ID = _cfg["orgId"]
DOMAIN = _cfg["domain"]

# Projects
HUB_PROJECT = _cfg["hubProject"]  # None if no VDSS/NVA
SPOKE_PROJECT = _cfg["spokeProject"]  # None if no networking stage
HAS_VDSS = _cfg["hasVdss"]

# VPC info
LANDING_VPC = _cfg.get("landingVpc")
DMZ_VPC = _cfg.get("dmzVpc")
SUBNETS = _cfg.get("subnets", {})

# Regions
PRIMARY_REGION = _cfg["regions"]["primary"]
SECONDARY_REGION = _cfg["regions"].get("secondary")

# Folder IDs (for workload project discovery)
ENVS_FOLDERS = _cfg.get("envsFolders", {})
NETWORKING_FOLDER = _cfg.get("networkingFolder")

# ─── Discover workload projects dynamically ──────────────────────────────────
SPOKE_PROJECTS = [p for p in [SPOKE_PROJECT] if p]
WORKLOAD_PROJECTS = discover_workload_projects(ORG_ID, ENVS_FOLDERS, SPOKE_PROJECTS)

# All projects to scan via CAI
ALL_PROJECTS = []
if HUB_PROJECT:
    ALL_PROJECTS.append(HUB_PROJECT)
if SPOKE_PROJECT:
    ALL_PROJECTS.append(SPOKE_PROJECT)
ALL_PROJECTS.extend(WORKLOAD_PROJECTS)

# Asset types to query from Cloud Asset Inventory
ASSET_TYPES = [
    "compute.googleapis.com/Instance",
    "compute.googleapis.com/Network",
    "compute.googleapis.com/Subnetwork",
    "compute.googleapis.com/ForwardingRule",
    "compute.googleapis.com/Router",
    "compute.googleapis.com/Route",
    "compute.googleapis.com/Firewall",
    "storage.googleapis.com/Bucket",
]

print(f"[CONFIG] Ready — {len(ALL_PROJECTS)} projects to monitor")
