# Looker GenAI Extension

This repository provides code examples and resources for building a Looker Extension that integrates with Vertex AI Large Language Models (LLMs). This extension allows users to leverage the power of LLMs to enhance data exploration and analysis within Looker. 

**Note:** For the Looker Explore Assistant, visit [https://github.com/looker-open-source/looker-explore-assistant/](https://github.com/looker-open-source/looker-explore-assistant/).

## Features

The Looker GenAI Extension offers two key functionalities:

**1. Generative Explore:**
   - Ask natural language questions about your data in Looker Explores.
   - The LLM will automatically generate explores with the appropriate fields, filters, sorts, pivots, and limits.
   - Visualize results using a variety of charts and dashboards.

   ![Data Exploration](/images/gif-explore.gif)

**2. Generative Insights on Dashboards:**
   - Analyze data from a Looker dashboard by asking natural language questions.
   - The LLM considers all data from the dashboard tiles for context-aware insights.

   ![Generative Insights on Dashboards](/images/gif-dashboard.gif)

## Architecture

The solution leverages the following components:

![Architecture](/images/looker-extension-architecture-overview.png)

### 2.1 Generative Explore Workflow

The extension supports multiple LLM integration options:

- **BQML Remote Models:**  (Default) Uses native BigQuery ML integration for simple and quick deployment.
- **BQML Remote UDF with Vertex AI:** (Recommended) Uses Google Cloud Functions with Vertex AI for greater flexibility and production-ready scenarios.
- **Custom Fine Tune Model:** (Optional) Enables training a customized fine-tuned model for tailored responses.

**Workflow for BQML Remote Models:**

![Workflow](/images/looker-extension-workflow-data-exploration.png)

**Workflow for BQML Remote UDF with Vertex AI:**

![Workflow](/images/looker-extension-workflow-data-exploration-fine-tuned-model.png)

**Workflow for Custom Fine Tune Model:**

![Workflow](/images/looker-extension-workflow-data-exploration-fine-tuned-model.png)

### 2.2 Generative Insights on Dashboards Workflow

![Workflow](/images/looker-extension-workflow-business-insights.png)

## Deployment

### 3. Deploy Infrastructure with Terraform

This section guides you through deploying the necessary infrastructure using Terraform.

1. **Clone the Repository:**
   ```sh
   cloudshell_open --repo_url "https://github.com/looker-open-source/extension-gen-ai" --page "shell" --open_workspace "deployment/terraform" --force_new_clone
   ```

   Alternatively, open directly in Cloud Shell:
   [![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://ssh.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https%3A%2F%2Fgithub.com%2Flooker-open-source%2Fextension-gen-ai&shellonly=true&cloudshell_workspace=deployment%2Fterraform)

2. **Set Project ID:**
   ```sh
   gcloud config set project PROJECT-ID
   ```

3. **IAM Roles:**
   - Ensure the following IAM roles are assigned at the project level:
     - `roles/browser`
     - `roles/cloudfunctions.developer`
     - `roles/iam.serviceAccountUser`
     - `roles/storage.admin`
     - `roles/bigquery.user`
     - `roles/bigquery.connectionAdmin`
     - `roles/resourcemanager.projectIamAdmin`
     - `roles/iam.serviceAccountCreator`

   For more detailed IAM information, see [deployment/terraform/iam-issues.md](deployment/terraform/iam-issues.md).

4. **Create Terraform State Buckets:**
   ```sh
   sh scripts/create-state-bucket.sh
   ```

5. **Initialize Terraform Modules:**
   ```sh
   terraform init
   ```

6. **Deploy Resources:**
   ```sh
   terraform apply -var="project_id=YOUR_PROJECT_ID"
   ```

### 4. Deploy the Looker Extension

1. **Create Looker Project:**
   - Log into Looker and create a new project named `looker-genai`. 
   - Use "Blank Project" as the "Starting Point."

2. **Copy Extension Files:**
   - Drag and drop the following files from the `looker-project-structure` folder into your Looker project:
     - `manifest.lkml`
     - `looker-genai.model`
     - `bundle.js`

3. **Configure BigQuery Connection:**
   - Modify `looker-genai.model` to include a Looker connection to BigQuery.
   - You can either create a new connection or use an existing one. If using an existing connection, ensure the service account has the necessary IAM permissions.

4. **Connect to Git:**
   - Set up a Git repository and connect your Looker project to it.

5. **Commit and Deploy:**
   - Commit your changes and deploy them to production.

6. **Project Permissions:**
   - Grant the project permission to use the selected BigQuery connection.

7. **Service Account Permissions:**
   - Verify that the service account associated with the connection has permission to access the `llm` dataset in your GCP project.

8. **Test and Debug:**
   - Test the extension and use the browser's Web Developer Console to troubleshoot any errors.
   - Review the `explore_logs` table in BigQuery to monitor queries.

## 5. Using and Configuring the Extension

### 5.1. Saving Example Prompts

Store example prompts in the `llm.explore_prompts` table:

```sql
INSERT INTO `llm.explore_prompts` 
VALUES("Top 3 brands in sales", "What are the top 3 brands that had the most sales price in the last 4 months?", "thelook.order_items", "explore")
```

**Values:**

- `name of example`
- `prompt`
- `model.explore` (LookML explore name)
- `type` (`explore` or `dashboard`)

### 5.2. Configuring User Settings

Settings are managed in the `llm.settings` table. You can adjust these settings in the "Developer Settings" tab of the extension.

- **Console Log Level:** Controls the verbosity of logs.
- **Use Native BQML or Remote UDF:** Choose between native BigQuery ML functions or custom remote UDFs.
- **Custom Prompt:**  Optionally set a custom prompt for your user ID.

**Modify Settings with SQL:**

- Change settings for all users:
  ```sql
  UPDATE `llm.settings` SET config = (SELECT config from `llm.settings` WHERE userId = "YOUR_USER_ID") WHERE True 
  ```

- Change settings for the default user:
  ```sql
  UPDATE `llm.settings` SET config = (SELECT config from `llm.settings` WHERE userId = "YOUR_USER_ID") WHERE userId IS NULL 
  ```

## 6. Developing the Looker Extension Environment

### 6.1. Install Dependencies

```shell
yarn install
```

### 6.2. Start the Development Server

```shell
yarn develop
```

   The development server will run at `https://localhost:8080/bundle.js`.

   ![Developing](/images/gif-developing.gif)

### 6.3. Build for Production

```shell
yarn build
```

   This will generate the `dist/bundle.js` file. Replace the URL in your LookML manifest with the production `bundle.js`.

## Advanced: Custom Fine-Tuned Model

This section describes how to train and deploy a custom fine-tuned model using the provided Terraform scripts.

1. **Infrastructure Setup:**
   - The provided Terraform code sets up Vertex AI, Cloud Functions, and BigQuery resources.
   - It also includes the necessary IAM permissions.

2. **Fine-Tuning:**
   - Execute the Cloud Workflow:
     ```sh
     gcloud workflows execute fine_tuning_model
     ```

3. **Update BigQuery Endpoint:**
   - Modify the BigQuery endpoint to point to your custom fine-tuned model.

**Note:** The code for fine-tuned model integration is currently in progress and needs to be refactored for optimal use.

---
