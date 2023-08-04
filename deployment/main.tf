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
variable "project_id" {
  type = string
  default = "dataml-latam-argolis"
}
variable "training_region"{
  type = string
  default = "europe-west4"
}

provider "google" {
  project = var.project_id
}

# [START workflows_api_enable]
resource "google_project_service" "workflows" {
  service            = "workflows.googleapis.com"
  disable_on_destroy = false
}

# [START workflows_api_enable]
resource "google_project_service" "storage" {
  service            = "storage.googleapis.com"
  disable_on_destroy = false
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
  depends_on = [google_project_service.storage, random_string.random]
  force_destroy = true
}

resource "google_storage_bucket_object" "training" {
 name         = "finetuning.jsonl"
 source       = "../llm-fine-tuning/finetuning.jsonl"
 content_type = "application/octet-stream"
 bucket       = google_storage_bucket.bucket-training-model.id
 depends_on = [google_storage_bucket.bucket-training-model]
}

# [START workflows_serviceaccount_create]
resource "google_service_account" "workflows_service_account" {
  account_id   = "looker-l-workflows-sa"
  display_name = "Sample Workflows Service Account"
}

resource "google_project_iam_member" "iam_permission" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
}
resource "google_project_iam_member" "iam_permission_workflow" {  
  project = var.project_id
  role    = "roles/workflows.admin"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
}
resource "google_project_iam_member" "iam_permission_editor" {  
  project = var.project_id
  role    = "roles/editor"
  member  = format("serviceAccount:%s", google_service_account.workflows_service_account.email)
}

resource "google_workflows_workflow" "workflow_fine_tuning" {
  name            = "fine_tuning_model"
  region          = "us-central1"
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
                        "location": "us-central1",
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
    - logResourceName:
        call: sys.log
        args:
            text: $${pipelineResourceName}
            severity: INFO
    - checkStatus:
        call: http.get        
        args:
            url: $${"https://europe-west4-aiplatform.googleapis.com/v1/projects/dataml-latam-argolis/locations/europe-west4/" + pipelineResourceName}
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
    - returnOutput:
        return: $${outputModel["output:model_resource_name"]}
EOF

  depends_on = [google_project_service.workflows]
}




