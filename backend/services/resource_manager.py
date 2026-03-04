"""Cloud Resource Manager service for org hierarchy."""
from google.cloud import resourcemanager_v3
from typing import Any


def get_org_hierarchy(org_id: str) -> dict[str, Any]:
    """Build the folder/project hierarchy for an organization."""
    folder_client = resourcemanager_v3.FoldersClient()
    project_client = resourcemanager_v3.ProjectsClient()

    hierarchy = {
        "orgId": org_id,
        "folders": [],
    }

    try:
        # List top-level folders
        folders = folder_client.list_folders(
            parent=f"organizations/{org_id}"
        )
        for folder in folders:
            folder_info = _build_folder(folder, folder_client, project_client)
            hierarchy["folders"].append(folder_info)
    except Exception as e:
        print(f"[RM] Error listing folders: {e}")

    return hierarchy


def _build_folder(folder, folder_client, project_client) -> dict[str, Any]:
    """Build a folder entry with its projects and child folders."""
    folder_id = folder.name.split("/")[-1]
    result = {
        "folderId": folder_id,
        "displayName": folder.display_name,
        "parent": folder.parent,
        "projects": [],
        "childFolders": [],
    }

    # List projects in this folder
    try:
        projects = project_client.list_projects(
            parent=folder.name
        )
        for project in projects:
            result["projects"].append({
                "projectId": project.project_id,
                "displayName": project.display_name,
                "state": project.state.name if project.state else "UNKNOWN",
                "labels": dict(project.labels) if project.labels else {},
            })
    except Exception as e:
        print(f"[RM] Error listing projects in {folder.name}: {e}")

    # List child folders
    try:
        child_folders = folder_client.list_folders(parent=folder.name)
        for child in child_folders:
            result["childFolders"].append(
                _build_folder(child, folder_client, project_client)
            )
    except Exception:
        pass

    return result
