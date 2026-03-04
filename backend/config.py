"""Configuration for Fast Science Infrastructure Visualizer."""
import os

# Organization
ORG_ID = os.environ.get("GCP_ORG_ID", "75514730725")
DOMAIN = os.environ.get("GCP_DOMAIN", "wandlzhang.altostrat.com")
PREFIX = os.environ.get("FAST_PREFIX", "wzuniv")

# L0 Projects
HUB_PROJECT = os.environ.get("HUB_PROJECT", f"{PREFIX}-net-vdss-host")
SPOKE_PROJECT = os.environ.get("SPOKE_PROJECT", f"{PREFIX}-prod-net-host")

# L2 Workload Projects (comma-separated)
WORKLOAD_PROJECTS = os.environ.get(
    "WORKLOAD_PROJECTS",
    f"{PREFIX}-pathology-medsiglip,{PREFIX}-genomics-nextflow"
).split(",")

# Regions
PRIMARY_REGION = os.environ.get("PRIMARY_REGION", "us-central1")
SECONDARY_REGION = os.environ.get("SECONDARY_REGION", "us-west1")

# All projects to scan
ALL_PROJECTS = [HUB_PROJECT, SPOKE_PROJECT] + WORKLOAD_PROJECTS

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
