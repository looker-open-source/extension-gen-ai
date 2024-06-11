# Looker GenAI Extension ∏

  - [1. Overview](#1-overview)
  - [2. Solutions architecture overview](#2-solutions-architecture-overview)
  - [3. Deploy the infrastructure using Terraform](#3-deploy-the-infrastructure-using-terraform)
  - [4. Deploying the Looker Extension](#4-deploying-the-looker-extension)
  - [5. Using and Configuring the Extension](#5-using-and-configuring-the-extension)
  - [6. Developing the Looker Extension Environment](#6-developing-the-looker-extension-environment)


## 1. Overview

This repository provides a comprehensive guide for building and deploying a Looker Extension that integrates Looker with Vertex AI Large Language Models (LLMs). This extension empowers you to leverage the power of natural language processing for data exploration and insight generation within your Looker environment.

**Looking for the official Looker Explore Assistant?**  Check out the repository at [https://github.com/looker-open-source/looker-explore-assistant/](https://github.com/looker-open-source/looker-explore-assistant/).

The Looker GenAI Extension offers two key functionalities:

**1.1. Generative Explore:**  Ask your data questions using natural language. The LLM Model will analyze your query and generate an interactive Looker Explore with the appropriate fields, filters, sorts, pivots, and limits to help you discover valuable insights.

![Data Exploration](/images/gif-explore.gif)

**1.2. Generative Insights on Dashboards:**  Leverage the data displayed on a Looker Dashboard as context for your questions. Ask the LLM model questions related to the dashboard's data, and receive insightful answers based on the provided context.

![Generative Insights on Dashboards](/images/gif-dashboard.gif)

This README is designed for developers and data analysts who want to understand and utilize the Looker GenAI Extension. It covers the deployment process, configuration options, and development environment setup.

## 2. Solutions architecture overview

![Architecture](/images/looker-extension-architecture-overview.png)

The Looker GenAI Extension relies on a robust architecture that seamlessly integrates with Looker and Google Cloud Platform (GCP) services. Here's a breakdown of the key components:

**2.1. Generative Explore:**

* **User Interface:**  The user interacts with the extension through a simple interface within Looker, where they can select an Explore and input their natural language questions.
* **Prompt Generation:**  The extension analyzes the selected Explore and the user's query to construct a well-formatted prompt for the LLM model.
* **LLM Model:**  The LLM model (e.g., Gemini Pro) processes the prompt and generates a response that includes the appropriate Looker Explore configuration.
* **Explore Rendering:**  The extension interprets the LLM model's response and dynamically renders the configured Explore within the Looker interface.

**2.2. Generative Insights on Dashboards:**

* **Dashboard Data Extraction:**  The extension gathers all the data displayed on the selected Looker Dashboard.
* **Contextual Prompt:**  The extension combines the extracted dashboard data with the user's question to create a contextual prompt for the LLM model.
* **LLM Model:**  The LLM model processes the contextual prompt and provides insights based on the dashboard's data.
* **Insight Display:**  The extension presents the LLM model's insights to the user within the Looker interface.

## 3. Deploy the infrastructure using Terraform

The Looker GenAI Extension requires a GCP project with the following resources:

* **BigQuery Dataset:**  A BigQuery dataset (default name: `llm`) to store configuration data, example prompts, and debug logs.
* **BigQuery Remote Model:** A BigQuery Remote Model (`llm_model`) pointing to the Gemini Pro API for LLM interactions.
* **IAM Service Accounts:**  Service accounts with the necessary permissions to connect to Looker and access the BigQuery dataset.
* **IAM Permissions:**  IAM permissions for the BigQuery connection to access Vertex AI.

**Prerequisites:**

* A Google Cloud Platform (GCP) project.
* Enable the necessary APIs in your GCP project (e.g., BigQuery, Vertex AI).
* A Google Cloud Shell environment.

**Instructions:**

1. **Clone the repository:**
   ```sh
   cloudshell_open --repo_url "https://github.com/looker-open-source/extension-gen-ai" --page "shell" --open_workspace "deployment/terraform" --force_new_clone
   ```
   Or run directly on your Cloud Shell session:
   [![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://ssh.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https%3A%2F%2Fgithub.com%2Flooker-open-source%2Fextension-gen-ai&shellonly=true&cloudshell_workspace=deployment%2Fterraform)

2. **Set project ID:**
   ```sh
   gcloud config set project PROJECT-ID
   ```

3. **Required IAM Roles:**
   Assign the following IAM roles at the project level of your PROJECT-ID:
   * `roles/browser`
   * `roles/cloudfunctions.developer`
   * `roles/iam.serviceAccountUser`
   * `roles/storage.admin`
   * `roles/bigquery.user`
   * `roles/bigquery.connectionAdmin`
   * `roles/resourcemanager.projectIamAdmin`
   * `roles/iam.serviceAccountCreator`
   
   For more information on IAM, refer to [deployment/terraform/iam-issues.md](deployment/terraform/iam-issues.md).

4. **Create Terraform state buckets:**
   ```sh
   sh scripts/create-state-bucket.sh
   ```

5. **Initialize Terraform modules:**
   ```sh
   terraform init
   ```

6. **Deploy resources:**
   ```sh
   terraform apply -var="project_id=YOUR_PROJECT_ID"  
   ```

While your Terraform deployment is running, proceed to the next steps for deploying the Looker Extension.

## 4. Deploying the Looker Extension

1. **Create a Looker Project:**
   Log in to Looker and create a new project named `looker-genai`. You can create a new project under:
   - **Develop** => **Manage LookML Projects** => **New LookML Project**, or
   - **Develop** => **Projects** => **New LookML Project**
   Select "Blank Project" as the "Starting Point".

2. **Add Extension Files:**
   Locate the `looker-project-structure` folder in this repository. Drag and drop the following files into your new Looker project:
   - `manifest.lkml`
   - `looker-genai.model`
   - `bundle.js`

3. **Configure BigQuery Connection:**
   Modify the `looker-genai.model` file to include the Looker connection to your BigQuery dataset. You can either create a new connection using the service account generated by Terraform or use an existing Looker connection. If using an existing connection, ensure that the service account has the necessary IAM permissions to access the `llm` dataset.

4. **Connect to Git:**
   Create a new repository on GitHub or a similar service and follow the instructions to [connect your project to Git](https://docs.looker.com/data-modeling/getting-started/setting-up-git-connection).

5. **Commit and Deploy:**
   Commit your changes and deploy them to production through the Looker Project UI.

6. **Project Permissions:**
   Ensure that your project has permission to use the BigQuery connection. Navigate to **Develop** => **Projects** => **Configure** and select ONLY the connection that will be used for the extension's LLM application.

7. **GCP Permissions:**
   Verify that the service account associated with the Looker connection has the necessary permissions to access the `llm` dataset in your GCP project.

8. **Test the Extension:**
   Open the Web Developer Console in your browser to check for errors or debug the extension. Verify that queries are being sent to BigQuery and executed correctly in your GCP project.

9. **Troubleshooting:**
   For any questions or issues, feel free to contact looker-genai-extension@google.com. You can also export the `explore_logs` table in BigQuery to CSV and send it for analysis.

## 5. Using and Configuring the Extension

### 5.1. Saving Example Prompts

You can save example prompts in the `llm.explore_prompts` table in BigQuery. This helps users get started with the extension and provides a reference for writing effective prompts.

```sql
INSERT INTO `llm.explore_prompts` 
VALUES("Top 3 brands in sales", "What are the top 3 brands that had the most sales price in the last 4 months?", "thelook.order_items", "explore")
```

The values to be inserted are:
* **name of example**: A descriptive name for the example prompt.
* **prompt**: The natural language question to be used as a prompt.
* **model.explore**: The Looker Explore model to be used for the prompt.
* **type**:  The type of prompt, either "explore" or "dashboard".

### 5.2. Configuring Settings

The Looker GenAI Extension allows you to configure settings for individual users or all users. These settings are stored in the `llm.settings` table in BigQuery. You can manage these settings through the "Developer Settings" tab within the extension.

**Available Settings:**

* **Console Log Level:** Controls the verbosity of logs sent to the console.
* **Use Native BQML or Remote UDF:**  Determines whether to use native BigQuery ML functions or custom remote User-Defined Functions (UDFs). Remote UDFs are recommended for production workloads.
* **Custom Prompt:**  Allows you to define a custom prompt that will be used for your user ID.

**Modifying Settings with SQL:**

You can modify settings directly in BigQuery using SQL. For example, to change settings for all users:

```sql
UPDATE `llm.settings` SET config = (SELECT config from `llm.settings` WHERE userId = "YOUR_USER_ID") WHERE True 
```

To change settings for the default user (userId is NULL):

```sql
UPDATE `llm.settings` SET config = (SELECT config from `llm.settings` WHERE userId = "YOUR_USER_ID") WHERE userId IS NULL 
```

## 6. Developing the Looker Extension Environment

To develop and customize the Looker GenAI Extension, follow these steps:

1. **Set up a Development Environment:**
   - Install Node.js and Yarn.
   - Clone the repository.
   - Install dependencies using `yarn install`.

2. **Start the Development Server:**
   ```shell
   yarn develop
   ```
   The development server will run at `https://localhost:8080/bundle.js`.

3. **Modify `manifest.lkml`:**
   Comment out the production `bundle.js` file and update the `url` to point to the development server:

   ```
   project_name: "looker-genai"
   application: looker-genai {
       label: "Looker GenAI Extension"
       url: "https://localhost:8080/bundle.js"
       # Comment production file: "bundle.js"
       entitlements: {
         use_embeds: yes
         use_form_submit: yes
         use_iframes: yes
         external_api_urls: ["https://localhost:8080","http://localhost:8080"]
         core_api_methods: ["run_inline_query", "me", "all_looks", "run_look", "all_lookml_models", "run_sql_query", "create_sql_query",
           "lookml_model_explore", "create_query", "use_iframes", "use_embeds",  "use_form_submit",
           "all_dashboards", "dashboard_dashboard_elements", "run_query", "dashboard", "lookml_model"] #Add more entitlements here as you develop new functionality
       }
   }
   ```

4. **Build for Production:**
   Once your development is complete, build the extension for production:
   ```shell
   yarn build
   ```
   This will generate the `dist/bundle.js` file. Update the `manifest.lkml` file to point to this production file.

**Remember to commit your changes to your Git repository and deploy the updated Looker project to production.**

## 7. Advanced and Optional: Fine Tuning the LLM Model

To enhance the accuracy and relevance of the LLM model's responses, you can fine-tune it using your own data and examples. This repository provides a sample Terraform script for fine-tuning the model using Vertex AI.

**Prerequisites:**

* A Vertex AI project.
* A dataset of training examples relevant to your data and use cases.

**Steps:**

1. **Deploy the Fine-Tuning Infrastructure:**
   Use the provided Terraform script to deploy the necessary infrastructure, including a Vertex AI Fine Tuned LLM Model, a Cloud Function to call the model's endpoint, and BigQuery datasets, connections, and Remote UDFs.

2. **Execute the Workflow:**
   Invoke the Cloud Workflows using `gcloud workflows execute fine_tuning_model`.

3. **Refactor SQL Endpoints:**
   Update the SQL endpoints to use the new UDFs and BigQuery syntax.

**Note:**  The fine-tuning process requires advanced knowledge of Vertex AI and LLM models.

By following these instructions, you can successfully deploy and use the Looker GenAI Extension to enhance your data exploration and insight generation capabilities within Looker. Remember to consult the official Looker documentation and GCP documentation for further information and support. 
