"""Read Stellar Engine tfvars JSON files from the GCS outputs bucket.

The outputs bucket ({prefix}-prod-iac-core-outputs-0) contains tfvars/ JSON files
that describe the entire deployed topology. This module reads them to auto-discover
the infrastructure without any hardcoded project names.
"""
import json
from typing import Any
from google.cloud import storage


def _read_json_from_gcs(bucket_name: str, blob_path: str) -> dict[str, Any]:
    """Read and parse a JSON file from GCS."""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    content = blob.download_as_text()
    return json.loads(content)


def read_globals(bucket_name: str) -> dict[str, Any]:
    """Read 0-globals.auto.tfvars.json → prefix, org, domain, groups."""
    data = _read_json_from_gcs(bucket_name, "tfvars/0-globals.auto.tfvars.json")
    org = data.get("organization", {})
    return {
        "prefix": data.get("prefix", ""),
        "orgId": str(org.get("id", "")),
        "domain": org.get("domain", ""),
        "customerId": org.get("customer_id", ""),
        "features": data.get("fast_features", {}),
    }


def read_bootstrap(bucket_name: str) -> dict[str, Any]:
    """Read 0-bootstrap.auto.tfvars.json → automation project, logging, folder."""
    data = _read_json_from_gcs(bucket_name, "tfvars/0-bootstrap.auto.tfvars.json")
    return {
        "automationProject": data.get("automation", {}).get("project_id", ""),
        "outputsBucket": data.get("automation", {}).get("outputs_bucket", ""),
        "commonServicesFolder": data.get("common_services_folder", ""),
        "assuredWorkloads": data.get("assured_workloads", {}),
    }


def read_resman(bucket_name: str) -> dict[str, Any]:
    """Read 1-resman.auto.tfvars.json → folder IDs for networking, security, envs."""
    data = _read_json_from_gcs(bucket_name, "tfvars/1-resman.auto.tfvars.json")
    folder_ids = data.get("folder_ids", {})
    return {
        "networkingFolder": folder_ids.get("networking"),
        "securityFolder": folder_ids.get("security"),
        "envsFolders": folder_ids.get("envs", {}),
        "serviceAccounts": data.get("service_accounts", {}),
    }


def read_networking(bucket_name: str) -> dict[str, Any] | None:
    """Read 2-networking.auto.tfvars.json → hub/spoke projects, VPCs, subnets.

    Returns None if the file doesn't exist (networking stage not deployed).
    """
    try:
        data = _read_json_from_gcs(bucket_name, "tfvars/2-networking.auto.tfvars.json")
    except Exception:
        return None

    vdss = data.get("vdss", {})
    envs = data.get("envs", {})
    host_project_ids = data.get("host_project_ids", {})

    # Extract spoke info per environment
    spokes = {}
    for env_name, env_data in envs.items():
        spokes[env_name] = {
            "hostProject": env_data.get("host_project", ""),
            "vpc": env_data.get("vpc", ""),
            "region": env_data.get("region", ""),
            "sharedSubnet": env_data.get("shared_subnet", ""),
        }

    # Extract subnet details from host_project_ids
    subnets = {}
    for env_name, host_data in host_project_ids.items():
        subnet_ids = host_data.get("subnet_ids", {})
        subnet_ips = host_data.get("subnet_ips", {})
        subnet_regions = host_data.get("subnet_regions", {})
        for key in subnet_ids:
            subnets[key] = {
                "id": subnet_ids.get(key, ""),
                "cidr": subnet_ips.get(key, ""),
                "region": subnet_regions.get(key, ""),
                "name": key.split("/")[-1] if "/" in key else key,
                "env": env_name,
            }

    # Determine regions from subnets
    regions = sorted(set(s["region"] for s in subnets.values() if s["region"]))

    return {
        "hubProject": vdss.get("landing_host"),
        "landingVpc": vdss.get("landing_vpc"),
        "dmzVpc": vdss.get("dmz_vpc"),
        "hasVdss": bool(vdss),
        "spokes": spokes,
        "subnets": subnets,
        "regions": regions,
        "hostProjectNumbers": data.get("host_project_numbers", {}),
    }


def discover_config(bucket_name: str) -> dict[str, Any]:
    """Read all tfvars and build a complete configuration.

    This is the main entry point — call this with just the outputs bucket name
    and it returns everything needed to configure the visualization.
    """
    print(f"[DISCOVER] Reading tfvars from gs://{bucket_name}/tfvars/...")

    globals_data = read_globals(bucket_name)
    bootstrap_data = read_bootstrap(bucket_name)
    resman_data = read_resman(bucket_name)
    networking_data = read_networking(bucket_name)

    prefix = globals_data["prefix"]

    # Build spoke project list
    spoke_projects = []
    if networking_data:
        for env_name, spoke in networking_data["spokes"].items():
            if spoke["hostProject"]:
                spoke_projects.append(spoke["hostProject"])

    # Determine hub project
    hub_project = networking_data["hubProject"] if networking_data and networking_data.get("hasVdss") else None

    # Determine regions
    regions = networking_data["regions"] if networking_data else []
    primary_region = regions[0] if regions else ""
    secondary_region = regions[1] if len(regions) > 1 else None

    config = {
        "prefix": prefix,
        "orgId": globals_data["orgId"],
        "domain": globals_data["domain"],
        "features": globals_data["features"],
        "hubProject": hub_project,
        "spokeProjects": spoke_projects,
        "spokeProject": spoke_projects[0] if spoke_projects else None,
        "hasVdss": networking_data["hasVdss"] if networking_data else False,
        "landingVpc": networking_data.get("landingVpc") if networking_data else None,
        "dmzVpc": networking_data.get("dmzVpc") if networking_data else None,
        "subnets": networking_data["subnets"] if networking_data else {},
        "regions": {"primary": primary_region, "secondary": secondary_region},
        "envsFolders": resman_data["envsFolders"],
        "networkingFolder": resman_data["networkingFolder"],
        "automationProject": bootstrap_data["automationProject"],
        "outputsBucket": bucket_name,
    }

    print(f"[DISCOVER] Prefix: {prefix}")
    print(f"[DISCOVER] Org: {globals_data['orgId']} ({globals_data['domain']})")
    print(f"[DISCOVER] Hub: {hub_project or '(none)'}")
    print(f"[DISCOVER] Spokes: {spoke_projects}")
    print(f"[DISCOVER] Regions: {regions}")
    print(f"[DISCOVER] VDSS: {networking_data['hasVdss'] if networking_data else False}")
    print(f"[DISCOVER] Subnets: {list((networking_data or {}).get('subnets', {}).keys())}")

    return config
