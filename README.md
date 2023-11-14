# Looker GenAI Extension 
- [Looker GenAI Extension](#looker-genai-extension)
  - [1. Overview](#1-overview)
  - [2. Solutions architecture overview](#2-solutions-architecture-overview)
    - [2.1 Data Exploration](#21-data-exploration)
      - [Workflow for Data Exploration with BQML Remote Models](#workflow-for-data-exploration-with-bqml-remote-models)
      - [Workflow for Data Exploration with Custom Fine Tune Model (Optional Path to be implemented)](#workflow-for-data-exploration-with-custom-fine-tune-model-optional-path-to-be-implemented)
    - [2.2 Business Insights](#22-business-insights)
      - [Workflow for Business Insights](#workflow-for-business-insights)
  - [3. Getting Started](#3-getting-started)
  - [4. Setting Up Infrastructure](#4-setting-up-infrastructure)
    - [4.1 Enable Cloud Resource Manager API](#41-enable-cloud-resource-manager-api)
    - [4.2 Deploy the infrastructure using Terraform](#42-deploy-the-infrastructure-using-terraform)
  - [5. Deploying the Looker Extension](#5-deploying-the-looker-extension)
  - [6. Developing the Looker Extension Environment](#6-developing-the-looker-extension-environment)
  - [6.1. Install the dependencies with Yarn](#61-install-the-dependencies-with-yarn)
  - [6.2 Start the development server](#62-start-the-development-server)
  - [6.3 Build for production](#63-build-for-production)
    - [**Advanced and Optional**: Executing the Fine Tuning Model](#advanced-and-optional-executing-the-fine-tuning-model)
      - [Execute the Workflow](#execute-the-workflow)

## 1. Overview
This repository compiles prescriptive code samples demonstrating how to create a Looker Extension integrating Looker with Vertex AI Large Language Models (LLMs).

Looker GenAI is an extension created to showcase interactivity between Looker and LLM with 2 main applications:
1.  Data Exploration using NLP and GenAI (ask a looker explore). Using Natural Language to ask your data about specific things. The LLM Model will try to find the right fields, filters, sorts, pivots and limits to explore the data.
2.  Business Insights on top of Dashboards. With this feature, we ingest all the data from the selected Dashboard as a context and can ask the LLM model a question based on the context provided

## 2. Solutions architecture overview

![Architecture](/images/looker-extension-architecture-overview.png)

There are two tabs on the extension:
### 2.1 Data Exploration
User chooses a Looker Explore and asks questions using natural language. The application gathers the metadata from the explore and creates a prompt to the LLM model that will return an explore with the appropriate fields, filters, sorts and pivots rendered on the Extension. The user can select a Visualization and add it to a Dashboard.

#### Workflow for Data Exploration with BQML Remote Models
The current default implementation uses the native integration between BigQuery and LLM models using BQML Remote Models [https://cloud.google.com/bigquery/docs/generate-text]

![Workflow](/images/looker-extension-workflow-data-exploration.png)

#### Workflow for Data Exploration with Custom Fine Tune Model (Optional Path to be implemented)
Optionally, users can train their own custom fine tune model, giving more examples to make it more accurate than the default model.
If users want to follow this path, on this repo there is a Terraform Deployment Example on how to achieve that using Cloud Workflows to orchestrate the creation of the Fine Tuned Model, the Cloud Function and BigQuery UDF calling the Cloud Function. Users needs to adapt the code and SQL queries to do the execution using the fine tuned model.

![Workflow](/images/looker-extension-workflow-data-exploration-fine-tuned-model.png)

### 2.2 Business Insights
User chooses a Looker Dashboard and asks questions using natural language. In this scenario, the Extension builds a prompt and sends all the data from all tiles to the LLM model as a context and the question from the user.
#### Workflow for Business Insights
![Workflow](/images/looker-extension-workflow-business-insights.png)

## 3. Getting Started
First, clone the repository to Cloud Shell or your machine
```
git clone https://github.com/looker-open-source/extension-gen-ai
```
Or run directly on your Cloud Shell session:

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://ssh.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https%3A%2F%2Fgithub.com%2Flooker-open-source%2Fextension-gen-ai&shellonly=true&cloudshell_image=gcr.io/ds-artifacts-cloudshell/deploystack_custom_image)

*Don't forget to trust the deploystack_custom_image image

## 4. Setting Up Infrastructure

Follow the steps below inside cloud shell with the GCP project to deploy the infrastructure needed

### 4.1 Enable Cloud Resource Manager API
```
  gcloud services enable cloudresourcemanager.googleapis.com
```

### 4.2 Deploy the infrastructure using Terraform
The architecture for the extension needs the following infrastructure in a GCP Project:
- BigQuery Dataset (default name: llm)
- BigQuery Remote Model pointing to Palm API (llm_model)
- IAM Service Accounts to create a connection to Looker
- IAM permission for BQ connection to connect to Vertex AI
  
Deploy the terraform script:

Run the following commands:
```
  cd deployment
  terraform init
  terraform apply -var="project_id=YOUR_PROJECT_ID"  
```

While your terraform is executing, follow instructions for [5. Deploying the Looker Extension](#5-deploying-the-looker-extension) or [6.Developing and Extending the Extension](#6-deploying-the-extension)


## 5. Deploying the Looker Extension

The Extension will be available directly through Marketplace or through a manual deployment described below:

1. Log in to Looker and create a new project named `looker-genai`.

    Depending on the version of Looker, a new project can be created under:

    - **Develop** => **Manage LookML Projects** => **New LookML Project**, or
    - **Develop** => **Projects** => **New LookML Project**

    Select "Blank Project" as the "Starting Point". This creates a new LookML project with no files.

2. In this github repository, there is a folder named `looker-project-structure`, containing 3 files:
  - `manifest.lkml`
  - `looker-genai.model`
  - `bundle.js`
  
    Drag and drop all the 3 files to the project folder.

3. Change the `looker-genai.model` to include the looker connection to BigQuery that will do.

    In this step you can create a new connection and use the service account generated from the terraform or use an existing Connection from Looker. If you use an existing connection, make sure to give the right **IAM permission** to the service account, so it can query and use the newly created connection and model.
   
4. Connect the new project to Git.

    Create a new repository on GitHub or a similar service, and follow the instructions to [connect your project to Git](https://docs.looker.com/data-modeling/getting-started/setting-up-git-connection) or setup a bare repository.

5. Commit the changes and deploy them to production through the Project UI.
   
6. Make sure that the project has permission to use this connection. 
  - **Develop** => **Projects** => **Configure** ==> Select ONLY the connection that will be used to connect to BigQuery for the Extension LLM application
   
7. Manually go the GCP Project, and make sure that the service account with the connection has permission to use the new created connection on the new llm dataset. 
   
8. Test the Extension. Open the Web Developer Console on the Browser to see errors or debug. Verify on your GCP project that the queries are coming to BigQuery and executing properly.
   
9. If you have any doubts, questions, feel free to e-mail: looker-genai-extension@google.com. We also have a debug table in BigQuery called explore_logs which you can export to CSV and send to us.


---
## 6. Developing the Looker Extension Environment

You can follow all the steps from Deploying the extension.
On the `manifest.lkml` comment the file and put the url to localhost

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



## 6.1. Install the dependencies with [Yarn](https://yarnpkg.com/)

```shell
yarn install
```

## 6.2 Start the development server

```shell
yarn develop
```

    The development server is now running and serving the JavaScript at https://localhost:8080/bundle.js.

## 6.3 Build for production

  Execute the yarn build to generate the `dist/bundle.js`, and commit to the LookML project
  Make sure to the manifest pointing to local prod file: "`bundle.js`"

```shell
yarn build
```

---
### **Advanced and Optional**: Executing the Fine Tuning Model
Vertex and LLM Backends
To execute fine tune model there is a sample terraform script provided on the repo.

The architecture needs the following infrastructure:
- VertexAI Fine Tuned LLM Model with the Looker App Examples
- Cloud Function that will call the Vertex AI Tuned Model Endpoint
- BigQuery Datasets, Connections and Remote UDF that will call the Cloud Function


TODO: The code have to be refactored to allow for the custom fine tuned model using BQ, Remote UDF and Cloud Function.

#### Execute the Workflow

Inside `gcloud` environment, invoke the Cloud Workflows
```shell
gcloud workflows execute fine_tuning_model
```

Refactor the SQL endpoints to use the new SQL syntax to use UDFs and BigQuery (Can check earlier commits on the repo)
