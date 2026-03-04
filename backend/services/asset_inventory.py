"""Cloud Asset Inventory service for listing GCP resources."""
from google.cloud import asset_v1
from typing import Any


def list_project_assets(project_id: str, asset_types: list[str]) -> list[dict[str, Any]]:
    """List all assets in a project using Cloud Asset Inventory."""
    client = asset_v1.AssetServiceClient()
    parent = f"projects/{project_id}"

    results = []
    for asset_type in asset_types:
        try:
            request = asset_v1.ListAssetsRequest(
                parent=parent,
                asset_types=[asset_type],
                content_type=asset_v1.ContentType.RESOURCE,
            )
            for asset in client.list_assets(request=request):
                resource_data = {}
                if asset.resource and asset.resource.data:
                    resource_data = dict(asset.resource.data)

                results.append({
                    "name": asset.name,
                    "assetType": asset.asset_type,
                    "project": project_id,
                    "displayName": resource_data.get("name", ""),
                    "state": _extract_state(asset_type, resource_data),
                    "location": resource_data.get("region", resource_data.get("zone", resource_data.get("location", ""))),
                    "data": resource_data,
                })
        except Exception as e:
            print(f"[CAI] Error listing {asset_type} in {project_id}: {e}")
            continue

    return results


def search_project_resources(project_id: str, asset_types: list[str] | None = None) -> list[dict[str, Any]]:
    """Search all resources in a project using SearchAllResources.
    
    Uses the asset_types parameter (not query field) to filter by resource type,
    as 'assetType' is not a supported query field for SearchAllResources.
    """
    client = asset_v1.AssetServiceClient()
    scope = f"projects/{project_id}"

    results = []
    try:
        request = asset_v1.SearchAllResourcesRequest(
            scope=scope,
            asset_types=asset_types if asset_types else [],
            page_size=500,
        )
        for resource in client.search_all_resources(request=request):
            results.append({
                "name": resource.name,
                "assetType": resource.asset_type,
                "project": resource.project,
                "displayName": resource.display_name,
                "state": resource.state or "UNKNOWN",
                "location": resource.location,
                "labels": dict(resource.labels) if resource.labels else {},
                "networkTags": list(resource.network_tags) if resource.network_tags else [],
                "additionalAttributes": dict(resource.additional_attributes) if resource.additional_attributes else {},
            })
    except Exception as e:
        print(f"[CAI] Error searching resources in {project_id}: {e}")

    return results


def _extract_state(asset_type: str, data: dict) -> str:
    """Extract resource state from resource data."""
    if "Instance" in asset_type:
        return data.get("status", "UNKNOWN").lower()
    if "Network" in asset_type or "Subnetwork" in asset_type:
        return "active"
    if "ForwardingRule" in asset_type:
        return "active" if data.get("IPAddress") else "pending"
    if "Router" in asset_type:
        return "active" if data.get("nats") else "pending"
    if "Bucket" in asset_type:
        return "active"
    return "unknown"
