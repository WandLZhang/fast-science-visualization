"""Flask backend for Fast Science Infrastructure Visualizer.

Auto-discovers infrastructure from Stellar Engine outputs bucket,
then serves live resource data from Cloud Asset Inventory.
"""
from flask import Flask, jsonify
from flask_cors import CORS

import config
from services.asset_inventory import search_project_resources

app = Flask(__name__)
CORS(app)


@app.route("/api/config")
def get_config():
    """Return auto-discovered infrastructure configuration."""
    return jsonify({
        "orgId": config.ORG_ID,
        "domain": config.DOMAIN,
        "prefix": config.PREFIX,
        "hubProject": config.HUB_PROJECT,
        "spokeProject": config.SPOKE_PROJECT,
        "workloadProjects": config.WORKLOAD_PROJECTS,
        "hasVdss": config.HAS_VDSS,
        "regions": {
            "primary": config.PRIMARY_REGION,
            "secondary": config.SECONDARY_REGION,
        },
        "subnets": config.SUBNETS,
    })


@app.route("/api/resources/<project_id>")
def get_project_resources(project_id: str):
    """Return all resources in a specific project."""
    if project_id not in config.ALL_PROJECTS:
        return jsonify({"error": f"Project {project_id} not in discovered list"}), 403
    try:
        resources = search_project_resources(project_id, config.ASSET_TYPES)
        grouped = {}
        for r in resources:
            type_key = r["assetType"].split("/")[-1].lower()
            grouped.setdefault(type_key, []).append(r)
        return jsonify(grouped)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/resources/all")
def get_all_resources():
    """Aggregate resources across all discovered projects."""
    result = {
        "config": {
            "orgId": config.ORG_ID,
            "domain": config.DOMAIN,
            "prefix": config.PREFIX,
            "hubProject": config.HUB_PROJECT,
            "spokeProject": config.SPOKE_PROJECT,
            "workloadProjects": config.WORKLOAD_PROJECTS,
            "hasVdss": config.HAS_VDSS,
            "regions": {
                "primary": config.PRIMARY_REGION,
                "secondary": config.SECONDARY_REGION,
            },
            "subnets": config.SUBNETS,
        },
        "hub": None,
        "spoke": None,
        "workloads": {},
    }

    # Hub project resources (only if VDSS exists)
    if config.HUB_PROJECT:
        hub = {"networks": [], "instances": [], "forwardingRules": [], "nats": []}
        try:
            hub_resources = search_project_resources(config.HUB_PROJECT, config.ASSET_TYPES)
            for r in hub_resources:
                asset_type = r["assetType"]
                if "Instance" in asset_type:
                    addl = r.get("additionalAttributes", {})
                    hub["instances"].append({
                        "name": r["displayName"],
                        "zone": r["location"],
                        "state": r["state"].lower() if r["state"] else "unknown",
                        "tags": r.get("networkTags", []),
                        "machineType": str(addl.get("machineType", "")),
                        "internalIPs": list(addl.get("internalIPs", [])),
                        "networks": [n.split("/")[-1] for n in addl.get("networkInterfaceNetworks", [])],
                    })
                elif "Network" in asset_type and "Sub" not in asset_type:
                    hub["networks"].append({"name": r["displayName"]})
                elif "ForwardingRule" in asset_type:
                    addl = r.get("additionalAttributes", {})
                    hub["forwardingRules"].append({
                        "name": r["displayName"],
                        "location": r["location"],
                        "ipAddress": addl.get("IPAddress", ""),
                    })
                elif "Router" in asset_type:
                    hub["nats"].append({
                        "name": r["displayName"],
                        "location": r["location"],
                    })
        except Exception as e:
            print(f"[MAIN] Error fetching hub resources: {e}")
        result["hub"] = hub

    # Spoke project resources (only if exists)
    if config.SPOKE_PROJECT:
        spoke = {"networks": [], "subnets": []}
        try:
            spoke_resources = search_project_resources(config.SPOKE_PROJECT, config.ASSET_TYPES)
            for r in spoke_resources:
                asset_type = r["assetType"]
                if "Network" in asset_type and "Sub" not in asset_type:
                    spoke["networks"].append({"name": r["displayName"]})
                elif "Subnetwork" in asset_type:
                    spoke["subnets"].append({
                        "name": r["displayName"],
                        "location": r["location"],
                    })
        except Exception as e:
            print(f"[MAIN] Error fetching spoke resources: {e}")
        result["spoke"] = spoke

    # Workload projects (dynamically discovered)
    for proj_id in config.WORKLOAD_PROJECTS:
        proj_data = {"project": {"projectId": proj_id}, "instances": [], "buckets": []}
        try:
            wl_resources = search_project_resources(proj_id, config.ASSET_TYPES)
            for r in wl_resources:
                if "Instance" in r["assetType"]:
                    addl = r.get("additionalAttributes", {})
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
    print(f"\n{'='*60}")
    print(f"  Fast Science Infrastructure Visualizer")
    print(f"  Outputs bucket: {config.OUTPUTS_BUCKET}")
    print(f"  Prefix: {config.PREFIX}")
    print(f"  Hub: {config.HUB_PROJECT or '(none)'}")
    print(f"  Spoke: {config.SPOKE_PROJECT or '(none)'}")
    print(f"  Workloads: {config.WORKLOAD_PROJECTS}")
    print(f"  Regions: {config.PRIMARY_REGION} / {config.SECONDARY_REGION or '(none)'}")
    print(f"{'='*60}\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
