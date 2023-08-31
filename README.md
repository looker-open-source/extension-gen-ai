# Looker GenAI Extension 
- [Looker GenAI Extension](#looker-genai-extension)
  - [1. Overview](#1-overview)
  - [2. Solutions architecture overview](#2-solutions-architecture-overview)
    - [2.1 Data Exploration](#21-data-exploration)
      - [Workflow for Data Exploration with BQML Remote Models](#workflow-for-data-exploration-with-bqml-remote-models)
    - [Workflow for Data Exploration with Custom Fine Tune Model (Optional Path)](#workflow-for-data-exploration-with-custom-fine-tune-model-optional-path)
    - [2.2 Business Insights](#22-business-insights)
      - [Workflow for Business Insights](#workflow-for-business-insights)
  - [3. Getting Started](#3-getting-started)
  - [4. Developing the Looker Extension Environment](#4-developing-the-looker-extension-environment)
  - [5. Deploying the Looker Extension](#5-deploying-the-looker-extension)
  - [5. Setting Up Vertex and LLM Backends](#5-setting-up-vertex-and-llm-backends)
    - [5.1 Enable Cloud Resource Manager API](#51-enable-cloud-resource-manager-api)
    - [5.1 Deploy the infrastructure using Terraform](#51-deploy-the-infrastructure-using-terraform)
    - [5.2 Execute the Workflow](#52-execute-the-workflow)
    - [5.3 Test the environment with a Simple Query](#53-test-the-environment-with-a-simple-query)

## 1. Overview
This repository compiles prescriptive code samples demonstrating how to create a Looker Extension integrating Looker with Vertex AI Large Language Models (LLMs).

Looker GenAI is an extension created to showcase interactivity between Looker and LLM with 2 main applications:
1.  Data Exploration using NLP and GenAI (ask a looker explore). Using Natural Language to ask your data about specific things. The LLM Model will try to find the right fields, filters and pivots to explore the data.
2.  Business Insights on top of Dashboards. With this feature, we ingest all the data from the selected Dashboard as a context and can ask the LLM model a question based on the context provided

## 2. Solutions architecture overview

![Architecture](/images/looker-extension-architecture-overview.png)

There are two tabs on the extension:
### 2.1 Data Exploration
User chooses a Looker Explore and asks questions using natural language. The application gathers the metadata from the explore and creates a prompt to the LLM model that will return an explore with the appropriate fields, filters, sorts and pivots rendered on the Extension. The user can select a Visualization and add it to a Dashboard.

#### Workflow for Data Exploration with BQML Remote Models
The current default implementation uses the native integration between BigQuery and LLM models using BQML Remote Models [https://cloud.google.com/bigquery/docs/generate-text]

![Workflow](/images/looker-extension-workflow-data-exploration.png)

### Workflow for Data Exploration with Custom Fine Tune Model (Optional Path)
Optionally, users can train their own custom fine tune model, giving more examples to make it more accurate than the default model.
If users want to follow this path, on this repo there is a Terraform Deployment Example on how to achieve that using Cloud Workflows to orchestrate the creation of the Fine Tuned Model, the Cloud Function and BigQuery UDF calling the Cloud Function.

![Workflow](/images/looker-extension-workflow-data-exploration-fine-tuned-model.png)

### 2.2 Business Insights
User chooses a Looker Dashboard and asks questions using natural language. In this scenario, the Extension builds a prompt and sends all the data from all tiles to the LLM model as a context and the question from the user.
#### Workflow for Business Insights
![Workflow](/images/looker-extension-workflow-business-insights.png)

## 3. Getting Started
First, clone the repository to Cloud Shell or your machine
```
git clone https://github.com/looker-opensource/looker-ai
```

Then follow instructions for [4. Developing the Extension](#3-getting-started-for-development-environment) or [5. Deploying the Extension](#4-deploying-the-extension)


## 4. Developing the Looker Extension Environment

1. Install the dependencies with [Yarn](https://yarnpkg.com/).

    ```sh
    yarn install
    ```

2. Build the project

    ```sh
    yarn build
    ```

3. Start the development server

    ```sh
    yarn develop
    ```

    The development server is now running and serving the JavaScript at https://localhost:8080/bundle.js.

4. Now log in to Looker and create a new project.

    Depending on the version of Looker, a new project can be created under:

    - **Develop** => **Manage LookML Projects** => **New LookML Project**, or
    - **Develop** => **Projects** => **New LookML Project**

    Select "Blank Project" as the "Starting Point". This creates a new LookML project with no files.

5. Create a `manifest` file

   Either drag and upload the `manifest.lkml` file in this directory into your Looker project, or create a `manifest.lkml` with the same content. Change the  `label` or `url` as needed.

   ```
    project_name: "looker-genai"
    application: looker-genai {
        label: "Looker GenAI Extension"
        # for development: url: "https://localhost:8080/bundle.js"
        # production
        file: "bundle.js"
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

6. Create a `model` LookML file in your project.

   Typically, the model is named the same as the extension project. The model is used to control access to the extension.

   - [Configure the model you created](https://docs.looker.com/data-modeling/getting-started/create-projects#configuring_a_model) so that it has access to some connection (any connection).

7. Connect the new project to Git.

   - Create a new repository on GitHub or a similar service, and follow the instructions to [connect your project to Git](https://docs.looker.com/data-modeling/getting-started/setting-up-git-connection)

8. Commit the changes and deploy them to production through the Project UI.

9. Reload the page and click the `Browse` dropdown menu. You should see the extension label in the list.

   - The extension will load the JavaScript from the `url` you provided in the `application` definition. By default, this is `https://localhost:8080/bundle.js`. If you change the port your server runs on in the `package.json`, you will need to also update it in the `manifest.lkml`.
   - Reloading the extension page will bring in any new code changes from the extension template.

## 5. Deploying the Looker Extension

To allow other people to use the extension, build the JavaScript bundle file and directly include it in the project.

1. Build the extension with `yarn build` in the extension project directory on your development machine.
2. Drag and drop the generated `dist/bundle.js` file into the Looker project interface
3. Modify your `manifest.lkml` to use `file` instead of `url`:

   ```
    project_name: "looker-genai-prod"
    application: looker-genai-prod {
      label: "looker-genai-prod"
      url: "bundle.js"    
      entitlements: {
        use_embeds: yes
        use_form_submit: yes
        use_iframes: yes
        external_api_urls: ["https://localhost:8080","http://localhost:8080"]
        core_api_methods: ["run_inline_query", "me", "all_looks", "run_look", "all_lookml_models", "run_sql_query", "create_sql_query",
          "lookml_model_explore", "create_query", "use_iframes", "use_embeds",  "use_form_submit",
          "all_dashboards", "dashboard_dashboard_elements", "run_query", "dashboard"] #Add more entitlements here as you develop new functionality
      }
    }
   ```
## 5. Setting Up Vertex and LLM Backends
The architecture needs the following infrastructure:
- VertexAI Fine Tuned LLM Model with the Looker App Examples
- Cloud Function that will call the Vertex AI Tuned Model Endpoint
- BigQuery Datasets, Connections and Remote UDF that will call the Cloud Function
  
All these dependencies will be deployed through Terraform in conjunction with Cloud Workflows for executing the LLM fine tuned training.

Follow the steps below:

### 5.1 Enable Cloud Resource Manager API
```
  gcloud services enable cloudresourcemanager.googleapis.com
```

### 5.1 Deploy the infrastructure using Terraform

Deploy the terraform script:
```
  cd deployment
  terraform init
  terraform apply 
```

### 5.2 Execute the Workflow

Inside `gcloud` environment, invoke the Cloud Workflows
```
gcloud workflows execute fine_tuning_model
```

### 5.3 Test the environment with a Simple Query
