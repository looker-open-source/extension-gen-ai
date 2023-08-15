/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module "project-services" {
  source                      = "terraform-google-modules/project-factory/google//modules/project_services"
  version                     = "14.2.1"
  disable_services_on_destroy = false

  project_id  = var.project_id
  enable_apis = true

  activate_apis = [
    "cloudresourcemanager.googleapis.com",
    "bigquery.googleapis.com",
    "bigqueryconnection.googleapis.com",    
    "cloudapis.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "iam.googleapis.com",
    "serviceusage.googleapis.com",
    "storage-api.googleapis.com",
    "storage.googleapis.com",
    "workflows.googleapis.com",
    "aiplatform.googleapis.com",
    "compute.googleapis.com"
  ]
}

resource "time_sleep" "wait_after_apis_activate" {
  depends_on      = [module.project-services]
  create_duration = "300s"
}

data "google_organization" "org" {
  domain = var.org_domain
  depends_on = [ time_sleep.wait_after_apis_activate ]
}
data "google_project" "project" {}

resource "google_organization_policy" "cloudfunction_ingress" {
  org_id     = data.google_organization.org.org_id
  constraint = "constraints/cloudfunctions.allowedIngressSettings"
  list_policy {
    suggested_value = "ALLOW_ALL"
    allow {
      all = true
    }
  }
  depends_on = [ time_sleep.wait_after_apis_activate ]
}
# [START storage_create_new_bucket_tf]
# Create new storage bucket in the US multi-region
# with coldline storage
resource "random_string" "random" {
  length = 3
  special = false
  lower = true
  upper = false
}

resource "google_storage_bucket" "bucket-training-model" {
  name          = "looker-ai-llm-training-${random_string.random.result}"
  location      = "us"
  uniform_bucket_level_access = true
  depends_on = [random_string.random, time_sleep.wait_after_apis_activate]
  force_destroy = true
}

resource "google_storage_bucket_object" "training" {
 name         = "finetuning.jsonl"
 source       = "../llm-fine-tuning/finetuning.jsonl"
 content_type = "application/octet-stream"
 bucket       = google_storage_bucket.bucket-training-model.id
 depends_on = [google_storage_bucket.bucket-training-model, time_sleep.wait_after_apis_activate]
}

# [START workflows_serviceaccount_create]
resource "google_service_account" "looker_llm_service_account" {
  account_id   = "looker-llm-sa"
  display_name = "Looker LLM SA"
  depends_on = [ time_sleep.wait_after_apis_activate ]
}
# TODO: Remove Editor and apply right permissions
resource "google_project_iam_member" "iam_permission_looker_bq" {
  project = var.project_id
  role    = "roles/editor"
  member  = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}
resource "google_project_iam_member" "iam_permission_looker_aiplatform" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}

resource "google_project_iam_member" "iam_service_account_act_as" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}
# IAM permission as Editor
resource "google_project_iam_member" "iam_looker_service_usage" {  
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}

# IAM permission as Editor
resource "google_project_iam_member" "iam_looker_bq_consumer" {  
  project = var.project_id
  role    = "roles/bigquery.connectionUser"
  member  = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}


# [START workflows_serviceaccount_create]
resource "google_service_account" "workflows_service_account" {
  account_id   = "looker-llm-workflows-sa"
  display_name = "Looker LLM Workflows"
  depends_on = [ time_sleep.wait_after_apis_activate ]
}


# IAM permission for BigQuery
resource "google_project_iam_member" "iam_permission" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}
# IAM permission for Cloud Workflows
resource "google_project_iam_member" "iam_permission_workflow" {  
  project = var.project_id
  role    = "roles/workflows.admin"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}

# IAM permission for Act As
resource "google_project_iam_member" "iam_permission_act_wf" {  
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}


# IAM permission as ai platform
resource "google_project_iam_member" "iam_wf_aiplatform" {  
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}

# TODO: Remove Editor and apply right permissions
resource "google_project_iam_member" "iam_permission_workflows_editor" {
  project = var.project_id
  role    = "roles/editor"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}

resource "google_project_iam_member" "iam_permission_default_workflows_editor" {
  project = var.project_id
  role    = "roles/editor"
  member  = format("serviceAccount:%s-compute@developer.gserviceaccount.com", data.google_project.project.number)
  depends_on = [ time_sleep.wait_after_apis_activate ]
}





# Cloud Workflows to Fine tune the LLM Model for Looker LLM Application
resource "google_workflows_workflow" "workflow_fine_tuning" {
  name            = "fine_tuning_model"
  region          = "${var.deployment_region}"
  description     = "Workflow to run a fine tuning model"  
  service_account = google_service_account.workflows_service_account.id
  source_contents = <<-EOF
# This is a sample workflow to test or replace with your source code.
#
# This workflow passes the region where the workflow is deployed
# to the Wikipedia API and returns a list of related Wikipedia articles.
# A region is retrieved from the GOOGLE_CLOUD_LOCATION system variable
# unless you input your own search term; for example, {"searchTerm": "asia"}.
main:
    params: [input]
    steps:
    # This process is needed according to: https://cloud.google.com/vertex-ai/docs/generative-ai/models/tune-models#troubleshooting
    - createEmptyVertexDatasets:
        call: http.post
        args:
            url: "https://${var.training_region}-aiplatform.googleapis.com/ui/projects/${var.project_id}/locations/${var.training_region}/datasets"
            auth:
                type: OAuth2
            body: {
                    "display_name": "test-name1",
                    "metadata_schema_uri": "gs://google-cloud-aiplatform/schema/dataset/metadata/image_1.0.0.yaml",
                    "saved_queries": [{"display_name": "saved_query_name", "problem_type": "IMAGE_CLASSIFICATION_MULTI_LABEL"}]
                }
    - wait5minutes:
        call: sys.sleep #Wait for API to complete
        args: 
            seconds: 300
        next: runFineTunningModel
    - runFineTunningModel:
        call: http.post        
        args:
            url: "https://${var.training_region}-aiplatform.googleapis.com/v1/projects/${var.project_id}/locations/${var.training_region}/pipelineJobs"
            auth:
                type: OAuth2
            body: {
                    "displayName": "llm-looker-finetuning",
                    "runtimeConfig": {
                        "gcsOutputDirectory": "${google_storage_bucket.bucket-training-model.url}/output",
                        "parameterValues": {
                        "project": "${var.project_id}",
                        "model_display_name": "looker-llm",
                        "dataset_uri": "${google_storage_bucket.bucket-training-model.url}/${google_storage_bucket_object.training.output_name}",
                        "location": "${var.deployment_region}",
                        "large_model_reference": "text-bison@001",
                        "train_steps": 100,
                        "learning_rate_multiplier": 0.002
                        }
                    },
                    "templateUri": "https://us-kfp.pkg.dev/ml-pipeline/large-language-model-pipelines/tune-large-model/v2.0.0"
                }
        result: fineTuningResult
    - extractPipelineResourceName:
        assign:
            - pipelineFullResourceName: $${fineTuningResult.body.name}
            - pipelineResourceNameMatch: $${text.find_all_regex(pipelineFullResourceName, "pipelineJobs/.*")}
            - pipelineResourceName: $${pipelineResourceNameMatch[0].match}
            - cloudFunctionName: "looker-llm-bq-remote"
    - logResourceName:
        call: sys.log
        args:
            text: $${pipelineResourceName}
            severity: INFO
    - checkStatus:
        call: http.get        
        args:
            url: $${"https://${var.training_region}-aiplatform.googleapis.com/v1/projects/${var.project_id}/locations/${var.training_region}/" + pipelineResourceName}
            auth:
                type: OAuth2 
        result: checkFineTuningStatus
    - extractStatus:
        assign:
            - pipelineStatus:  $${checkFineTuningStatus.body.state}
    - logStatus:
        call: sys.log
        args:
            text: $${pipelineStatus}
            severity: INFO            
    - assertFinishedTraining:
        switch:
            - condition: $${pipelineStatus == "PIPELINE_STATE_SUCCEEDED"}
              next: extractCurrentTaskDetails
            - condition: $${pipelineStatus == "PIPELINE_STATE_FAILED" or pipelineStatus == "PIPELINE_STATE_CANCELLING"}
              next: returnErrorPipelineStatus
        next: sleepPooling
    - returnErrorPipelineStatus:
        return: "Error Pipeline Failed"
    - sleepPooling:
        call: sys.sleep #Pooling through Sleep
        args: 
            seconds: 20
        next: checkStatus    
    - extractCurrentTaskDetails:
        assign:
            - taskDetails: $${checkFineTuningStatus.body.jobDetail.taskDetails}
            - outputModel: ""
    - checkTaskDetais:
        for:
            value: currentTaskDetail
            in: $${taskDetails}
            steps:
                - checkStepName:
                    switch:
                        - condition: $${currentTaskDetail.taskName == "deployment-graph"}
                          next: setTaskDetail
                    next: continue
                - setTaskDetail:
                    assign:
                        - taskDetail:  $${currentTaskDetail}
                        - outputModel: $${currentTaskDetail.execution.metadata}
                    next: break

    - printTaskDetail:
        call: sys.log
        args:
            text: $${outputModel["output:model_resource_name"]}
            severity: INFO
    - create_function:
        call: googleapis.cloudfunctions.v1.projects.locations.functions.create
        args:
          location: "projects/${data.google_project.project.number}/locations/${var.deployment_region}"
          body:
            name: "projects/${data.google_project.project.number}/locations/${var.deployment_region}/functions/bq_vertex_remote"
            description: "cloud function to be remote udf function for bigquery to call vertex ai fine tuned model"
            entryPoint: "bq_vertex_remote"
            runtime: "python311"
            serviceAccountEmail: ${google_service_account.looker_llm_service_account.email}
            sourceArchiveUrl: "gs://${google_storage_bucket.bucket-training-model.name}/bq_remote_function.zip}"
            httpsTrigger:
              securityLevel: "SECURE_OPTIONAL"
            environmentVariables:                
                PROJECT_ID : "${var.project_id}"
                LOCATION : "${var.deployment_region}"
                TUNED_MODEL_URL : $${outputModel["output:model_resource_name"]}
    - create_remote_function:
        call: googleapis.bigquery.v2.jobs.query
        args:
            projectId: ${var.project_id}
            body:
                query: |
                    CREATE OR REPLACE FUNCTION 
                    `${var.project_id}`.llm_${random_string.random.result}.bq_vertex_remote(prompt STRING) RETURNS STRING
                    REMOTE WITH CONNECTION `${var.project_id}.${var.bq_region}.${var.bq_remote_connection_name}-${random_string.random.result}` 
                    OPTIONS (endpoint = '$${create_function.functions_bq_remote_udf.https_trigger_url}')
    - grant_permission_to_all:
        call: googleapis.cloudfunctions.v1.projects.locations.functions.setIamPolicy
        args:
          resource: "projects/${var.project_id}/locations/${var.deployment_region}/functions/bq_vertex_remote"
          body:
            policy:
              bindings:
                - members: ${format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)}
                  role: "roles/cloudfunctions.invoker"
EOF

  depends_on = [time_sleep.wait_after_apis_activate, google_bigquery_dataset.dataset, data.google_project.project]
}

# Generate the File to upload go GCS for Cloud Function
data "archive_file" "default" {
  type        = "zip"
  output_path = "/tmp/function-source.zip"
  source_dir  = "../cloud-function-remote/src"
}

# Bucket with source code for Cloud Function
resource "google_storage_bucket_object" "functions_bq_remote_udf" {
  name   = "bq_remote_function.zip"
  bucket = google_storage_bucket.bucket-training-model.name
  source =  data.archive_file.default.output_path
  depends_on = [ data.archive_file.default , time_sleep.wait_after_apis_activate]
}

resource "google_bigquery_dataset" "dataset" {
  dataset_id                  = "llm_${random_string.random.result}"
  friendly_name               = "llm"
  description                 = "bq llm dataset for remote UDF"
  location                    = var.bq_region
  depends_on = [ time_sleep.wait_after_apis_activate ]
}

 ## This creates a cloud resource connection.
 ## Note: The cloud resource nested object has only one output only field - serviceAccountId.
 resource "google_bigquery_connection" "connection" {
    connection_id =  "${var.bq_remote_connection_name}-${random_string.random.result}"
    project = var.project_id
    location = var.bq_region
    cloud_resource {}
    depends_on = [ time_sleep.wait_after_apis_activate ]
}





