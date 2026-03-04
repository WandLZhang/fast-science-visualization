"""Flask backend for Fast Science Infrastructure Visualizer.

Serves GCP resource data from Cloud Asset Inventory and Resource Manager
to the ReactFlow frontend.
"""
import json
from flask import Flask, jsonify
from flask_cors import CORS

import config
from services.asset_inventory import search_project_resources
from services.resource_manager import get_org_hierarchy

app = Flask(__name__)
CORS(app)


@app.route("/api/config")
def get_config():
    """Return infrastructure configuration."""
    return jsonify({
        "orgId": config.ORG_ID,
        "domain": config.DOMAIN,
        "prefix": config.PREFIX,
        "hubProject": config.HUB_PROJECT,
        "spokeProject": config.SPOKE_PROJECT,
        "workloadProjects": config.WORKLOAD_PROJECTS,
        "regions": {
            "primary": config.PRIMARY_REGION,
            "secondary": config.SECONDARY_REGION,
        },
    })


@app.route("/api/hierarchy")
def get_hierarchy():
    """Return organization folder/project hierarchy."""
    try:
        hierarchy = get_org_hierarchy(config.ORG_ID)
        return jsonify(hierarchy)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/resources/<project_id>")
def get_project_resources(project_id: str):
    """Return all resources in a specific project."""
    if project_id not in config.ALL_PROJECTS:
        return jsonify({"error": f"Project {project_id} not in allowed list"}), 403
    try:
        resources = search_project_resources(project_id, config.ASSET_TYPES)
        # Group by asset type
        grouped = {}
        for r in resources:
            type_key = r["assetType"].split("/")[-1].lower()
            grouped.setdefault(type_key, []).append(r)
        return jsonify(grouped)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/resources/all")
def get_all_resources():
    """Aggregate resources across all projects for the frontend graph."""
    result = {
        "config": {
            "orgId": config.ORG_ID,
            "domain": config.DOMAIN,
            "prefix": config.PREFIX,
            "hubProject": config.HUB_PROJECT,
            "spokeProject": config.SPOKE_PROJECT,
            "workloadProjects": config.WORKLOAD_PROJECTS,
            "regions": {
                "primary": config.PRIMARY_REGION,
                "secondary": config.SECONDARY_REGION,
            },
        },
        "hierarchy": {"orgId": config.ORG_ID, "domain": config.DOMAIN, "folders": []},
        "hub": {"networks": [], "instances": [], "forwardingRules": [], "nats": []},
        "spoke": {"networks": [], "subnets": []},
        "workloads": {},
    }

    # Hub project resources
    try:
        hub_resources = search_project_resources(config.HUB_PROJECT, config.ASSET_TYPES)
        for r in hub_resources:
            asset_type = r["assetType"]
            if "Instance" in asset_type:
                result["hub"]["instances"].append({
                    "name": r["displayName"],
                    "zone": r["location"],
                    "state": r["state"].lower() if r["state"] else "unknown",
                    "tags": r.get("networkTags", []),
                })
            elif "Network" in asset_type and "Sub" not in asset_type:
                result["hub"]["networks"].append({
                    "name": r["displayName"],
                    "routingMode": r.get("additionalAttributes", {}).get("routingMode", ""),
                })
            elif "ForwardingRule" in asset_type:
                result["hub"]["forwardingRules"].append({
                    "name": r["displayName"],
                    "location": r["location"],
                    "state": r["state"],
                })
            elif "Router" in asset_type:
                result["hub"]["nats"].append({
                    "name": r["displayName"],
                    "location": r["location"],
                })
    except Exception as e:
        print(f"[MAIN] Error fetching hub resources: {e}")

    # Spoke project resources
    try:
        spoke_resources = search_project_resources(config.SPOKE_PROJECT, config.ASSET_TYPES)
        for r in spoke_resources:
            asset_type = r["assetType"]
            if "Network" in asset_type and "Sub" not in asset_type:
                result["spoke"]["networks"].append({"name": r["displayName"]})
            elif "Subnetwork" in asset_type:
                result["spoke"]["subnets"].append({
                    "name": r["displayName"],
                    "location": r["location"],
                })
    except Exception as e:
        print(f"[MAIN] Error fetching spoke resources: {e}")

    # Workload projects
    for proj_id in config.WORKLOAD_PROJECTS:
        proj_data = {"project": {"projectId": proj_id}, "instances": [], "buckets": []}
        try:
            wl_resources = search_project_resources(proj_id, config.ASSET_TYPES)
            for r in wl_resources:
                if "Instance" in r["assetType"]:
                    addl = r.get("additionalAttributes", {})
                    # Extract network name from full URL
                    networks = list(addl.get("networkInterfaceNetworks", []))
                    network_name = networks[0].split("/")[-1] if networks else ""
                    proj_data["instances"].append({
                        "name": r["displayName"],
                        "zone": r["location"],
                        "state": r["state"].lower() if r["state"] else "unknown",
                        "machineType": str(addl.get("machineType", "")),
                        "internalIPs": list(addl.get("internalIPs", [])),
                        "network": network_name,
                        "networkTags": list(r.get("networkTags", [])),
                        "labels": dict(r.get("labels", {})),
                    })
                elif "Bucket" in r["assetType"]:
                    proj_data["buckets"].append({
                        "name": r["displayName"],
                        "location": r["location"],
                    })
        except Exception as e:
            print(f"[MAIN] Error fetching workload resources for {proj_id}: {e}")
        result["workloads"][proj_id] = proj_data

    return jsonify(result)


if __name__ == "__main__":
    print(f"[CONFIG] Hub: {config.HUB_PROJECT}")
    print(f"[CONFIG] Spoke: {config.SPOKE_PROJECT}")
    print(f"[CONFIG] Workloads: {config.WORKLOAD_PROJECTS}")
    print(f"[CONFIG] Regions: {config.PRIMARY_REGION} / {config.SECONDARY_REGION}")
    app.run(host="0.0.0.0", port=5000, debug=True)
