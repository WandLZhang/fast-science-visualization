"""Discover workload projects dynamically using Cloud Asset Inventory.

Given the envs folder IDs from Stellar Engine's resman stage, finds all
ACTIVE projects in those folders that aren't spoke host projects.
"""
from google.cloud import asset_v1
from typing import Any


def discover_workload_projects(
    org_id: str,
    envs_folders: dict[str, str],
    spoke_projects: list[str],
) -> list[str]:
    """Find all ACTIVE projects in envs folders that aren't spoke hosts.

    Args:
        org_id: Organization ID
        envs_folders: Map of env name → folder ID (e.g., {"Prod": "folders/123"})
        spoke_projects: List of spoke host project IDs to exclude

    Returns:
        List of workload project IDs
    """
    client = asset_v1.AssetServiceClient()
    workload_projects = []
    spoke_set = set(spoke_projects)

    for env_name, folder_id in envs_folders.items():
        if not folder_id:
            continue

        folder_num = folder_id.replace("folders/", "")
        print(f"[DISCOVER] Scanning {env_name} folder ({folder_num}) for workload projects...")

        try:
            request = asset_v1.SearchAllResourcesRequest(
                scope=f"organizations/{org_id}",
                asset_types=["cloudresourcemanager.googleapis.com/Project"],
                query=f"folders:{folder_num}",
                page_size=100,
            )

            for resource in client.search_all_resources(request=request):
                project_id = resource.display_name
                state = resource.state or ""

                if state != "ACTIVE":
                    continue
                if project_id in spoke_set:
                    continue

                workload_projects.append(project_id)
                print(f"[DISCOVER]   Found workload project: {project_id}")

        except Exception as e:
            print(f"[DISCOVER] Error scanning folder {folder_id}: {e}")
            # Fallback: try searching by folder membership in the folders list
            try:
                request = asset_v1.SearchAllResourcesRequest(
                    scope=f"folders/{folder_num}",
                    asset_types=["cloudresourcemanager.googleapis.com/Project"],
                    page_size=100,
                )
                for resource in client.search_all_resources(request=request):
                    project_id = resource.display_name
                    if resource.state == "ACTIVE" and project_id not in spoke_set:
                        workload_projects.append(project_id)
                        print(f"[DISCOVER]   Found workload project (fallback): {project_id}")
            except Exception as e2:
                print(f"[DISCOVER] Fallback also failed: {e2}")

    # Deduplicate while preserving order
    seen = set()
    result = []
    for p in workload_projects:
        if p not in seen:
            seen.add(p)
            result.append(p)

    print(f"[DISCOVER] Total workload projects: {len(result)}")
    return result
