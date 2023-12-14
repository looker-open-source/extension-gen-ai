## Installation Steps

These instructions will guide you through the process of installing the `extension-gen-ai` required resources using your **Google Cloud Shell**.


### 1. Clone the repository

Open Cloud Shell and clone the `extension-gen-ai` deployment files:

```sh
cloudshell_open --repo_url "https://github.com/looker-open-source/extension-gen-ai" --page "shell" --open_workspace "deployment/terraform" --force_new_clone
```

### 2. Set project ID

Set the `gcloud` command to use the desired project ID:

```sh
gcloud config set project PROJECT-ID
```

### 3. Create Terraform state buckets

Run the script to create the Terraform state buckets:

```sh
sh scripts/create-state-bucket.sh
```

### 4. Initialize Terraform modules

Initialize the Terraform modules:

```sh
terraform init
```

### 5. Deploy resources

Deploy the Terraform resources:

```sh
terraform apply
```
