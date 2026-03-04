# Fast Science Infrastructure Visualizer

Interactive dashboard showing the full Fast Science GCP infrastructure — L0 foundation (Stellar Engine), L1 project factory, and L2 researcher workloads — as a live ReactFlow graph with nested project and VPC boundaries.

## Architecture

```
L0 (IT Admin)          L1 (IT Admin)           L2 (Researcher)
┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Bootstrap    │   │ Project Factory  │   │ Workload Projects│
│ Folders/SAs  │──>│ YAML per project │──>│ VMs, Buckets,    │
│ VPCs/NVAs/NAT│   │ Shared VPC       │   │ Notebooks        │
│ KMS/Alerts   │   │ IAM, Billing     │   │ Pipelines        │
└──────────────┘   └──────────────────┘   └──────────────────┘
```

**Data source**: Cloud Asset Inventory API for live resource state across all projects.

## Setup

### 1. Set environment variables

```bash
export GCP_ORG_ID="75514730725"
export FAST_PREFIX="wzuniv"
export HUB_PROJECT="wzuniv-net-vdss-host"
export SPOKE_PROJECT="wzuniv-prod-net-host"
export WORKLOAD_PROJECTS="wzuniv-pathology-medsiglip"
export PRIMARY_REGION="us-central1"
export SECONDARY_REGION="us-west1"
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Backend runs on `http://localhost:5000`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

### 4. Authenticate

The backend uses Application Default Credentials:

```bash
gcloud auth application-default login
```

The authenticated user needs `cloudasset.assets.searchAllResources` permission on the target projects (typically granted via `roles/cloudasset.viewer`).

## What it Shows

- **IT Admin section**: L0 stages (Bootstrap, Folders, Networking, Security), hub project with Landing/DMZ VPCs, NVA MIGs, ILBs, Cloud NAT, VPC peering, spoke project with subnets
- **Researcher section**: L2 workload projects with VM status, GCS buckets
- **Live status**: Green = running/active, blue = in progress, gray = pending
- **GCP differentiators**: Click on key resources to see "Why Google Cloud" tooltips

## Related Repos

| Layer | Repo | Purpose |
|-------|------|---------|
| **L0** | [fast-science-0-stellar-engine](https://github.com/WandLZhang/fast-science-0-stellar-engine) | GCP org landing zone |
| **L1** | [fast-science-1-researcher-lab](https://github.com/WandLZhang/fast-science-1-researcher-lab) | Researcher project provisioning |
| **L2** | [fast-science-2-workload-catalog](https://github.com/WandLZhang/fast-science-2-workload-catalog) | Science workloads |
