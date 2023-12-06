# Copyright (c) 2023 Google LLC
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of
# this software and associated documentation files (the "Software"), to deal in
# the Software without restriction, including without limitation the rights to
# use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
# the Software, and to permit persons to whom the Software is furnished to do so,
# subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
# COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
# IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
# CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

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
    "compute.googleapis.com",
    "run.googleapis.com"
  ]
}

resource "time_sleep" "wait_after_apis_activate" {
  depends_on      = [module.project-services]
  create_duration = "300s"
}


data "google_project" "project" {}

# [START storage_create_new_bucket_tf]
# Create new storage bucket in the US multi-region
# with coldline storage
resource "random_string" "random" {
  length  = 3
  special = false
  lower   = true
  upper   = false
}

# [START workflows_serviceaccount_create]
resource "google_service_account" "looker_llm_service_account" {
  account_id   = "looker-llm-sa"
  display_name = "Looker LLM SA"
  depends_on   = [time_sleep.wait_after_apis_activate]
}
# TODO: Remove Editor and apply right permissions
resource "google_project_iam_member" "iam_permission_looker_bq" {
  project    = var.project_id
  role       = "roles/editor"
  member     = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [time_sleep.wait_after_apis_activate]
}
resource "google_project_iam_member" "iam_permission_looker_aiplatform" {
  project    = var.project_id
  role       = "roles/aiplatform.user"
  member     = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [time_sleep.wait_after_apis_activate]
}

# IAM for connection to be able to execute vertex ai queries through BQ
resource "google_project_iam_member" "bigquery_connection_remote_model" {
  project    = var.project_id
  role       = "roles/aiplatform.user"
  member     = format("serviceAccount:%s", google_bigquery_connection.connection.cloud_resource[0].service_account_id)
  depends_on = [time_sleep.wait_after_apis_activate, google_bigquery_connection.connection]
}



resource "google_project_iam_member" "iam_service_account_act_as" {
  project    = var.project_id
  role       = "roles/iam.serviceAccountUser"
  member     = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [time_sleep.wait_after_apis_activate]
}
# IAM permission as Editor
resource "google_project_iam_member" "iam_looker_service_usage" {
  project    = var.project_id
  role       = "roles/serviceusage.serviceUsageConsumer"
  member     = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [time_sleep.wait_after_apis_activate]
}

# IAM permission as Editor
resource "google_project_iam_member" "iam_looker_bq_consumer" {
  project    = var.project_id
  role       = "roles/bigquery.connectionUser"
  member     = format("serviceAccount:%s", google_service_account.looker_llm_service_account.email)
  depends_on = [time_sleep.wait_after_apis_activate]
}

resource "google_bigquery_dataset" "dataset" {
  dataset_id    = var.dataset_id_name
  friendly_name = "llm"
  description   = "bq llm dataset for remote UDF"
  location      = var.bq_region

  depends_on = [time_sleep.wait_after_apis_activate]
}

## This creates a cloud resource connection.
## Note: The cloud resource nested object has only one output only field - serviceAccountId.
resource "google_bigquery_connection" "connection" {
  connection_id = "${var.bq_remote_connection_name}-${random_string.random.result}"
  project       = var.project_id
  location      = var.bq_region
  cloud_resource {}
  depends_on = [time_sleep.wait_after_apis_activate]
}

resource "google_bigquery_job" "create_bq_model_llm" {
  job_id = "create_looker_llm_model-${random_string.random.result}"
  query {
    query              = <<EOF
CREATE OR REPLACE MODEL `${var.project_id}.${var.dataset_id_name}.llm_model` 
REMOTE WITH CONNECTION `${var.project_id}.${var.bq_region}.${var.bq_remote_connection_name}-${random_string.random.result}` 
OPTIONS (endpoint = 'text-bison-32k')
EOF  
    create_disposition = ""
    write_disposition  = ""
  }
  depends_on = [google_bigquery_connection.connection, google_bigquery_dataset.dataset, time_sleep.wait_after_apis_activate]
}

resource "google_bigquery_table" "table_top_prompts" {
  dataset_id          = google_bigquery_dataset.dataset.dataset_id
  table_id            = "explore_prompts"
  deletion_protection = false

  schema     = <<EOF
[
  {
    "name": "description",
    "type": "STRING",
    "mode": "REQUIRED"
  },
  {
    "name": "prompt",
    "type": "STRING",
    "mode": "REQUIRED"
  },  
  {
    "name": "model_explore",
    "type": "STRING",
    "mode": "REQUIRED"
  },
  {
    "name": "type",
    "type": "STRING", 
    "mode": "NULLABLE"       
  }
]
EOF
  depends_on = [time_sleep.wait_after_apis_activate]
}

resource "google_bigquery_table" "table_explore_logging" {
  dataset_id = google_bigquery_dataset.dataset.dataset_id
  table_id   = "explore_logging"
  time_partitioning {
    type  = "DAY"
    field = "creation_timestamp"
  }
  deletion_protection = false
  schema              = <<EOF
[{
	"name": "userInput",
	"type": "STRING"
}, {
	"name": "modelFields",
	"type": "JSON"
}, {
	"name": "llmResult",
	"type": "JSON"
}, {
	"name": "creation_timestamp",
	"type": "TIMESTAMP"
},
{
	"name": "thumbsUpDownNone",
	"type": "INT64"
} 
]
EOF
  depends_on = [time_sleep.wait_after_apis_activate]
}


resource "google_bigquery_table" "table_settings" {
  dataset_id = google_bigquery_dataset.dataset.dataset_id
  table_id   = "settings"  
  deletion_protection = false
  schema              = <<EOF
[{
	"name": "config",
	"type": "JSON"
}, {
	"name": "userId",
	"type": "STRING"
}]
EOF
  depends_on = [google_bigquery_dataset.dataset]
}


resource "google_bigquery_job" "insert_default_settings" {
  job_id = "insert_default_settings-${random_string.random.result}"
  query {
    query              = <<EOF
INSERT INTO `${var.project_id}.${var.dataset_id_name}.settings`(config, userId)
VALUES(JSON_OBJECT('logLevel', "info", 'llmModelSize', '32', 'useNativeBQ', "true", 'customPrompt', 
"""
Context: {{serializedModelFields}}
Question: {{userInput}}

1. Extract the exact fields names, filters and sorts from the Context in a JSON format that can help answer the Question.
2. The fields are in the format "table.field".
3. If the Question contains a "top", "bottom", insert a "count" inside the fields.
4. Make sure to select the minimum amount of field_names needed to answer the question.
5. Put all the sortings inside sort array
6. field_names only contains a list of field_names with the format "table.field"
7. limit is string and default value is "500" if empty.
8. Filters have the syntax from Looker

JSON output format has only the following keys
{
"field_names": [],
"filters": {},
"sorts": [], 
"limit": "500"
}

Examples:
Q: "What are the top 10 total sales price per brand. With brands: Levi's, Calvin Klein, Columbia"
{"field_names":["products.brand","order_items.total_sale_price"],"filters":{"products.brand":"Levi's, Calvin Klein, Columbia"}, "limit": "10"}

Q: "What are the top sales price, category, cost pivot per day and filter only orders with more than 15 items"
{"field_names":["order_items.total_sale_price", "products.category", "inventory_items.cost", "orders.created_date"], "filters": {"order_items.count": "> 15"}, "sorts": ["order_items.total_sales_price desc"]}

Q: "How many orders were created in the past 7 days"
{"field_names": ["orders.count"], "filters": {"sales_order.created_date": "7 days"}, "sorts": []}

Q: "What are the top 10 languages?"
{"field_names": ["wiki100_m.language","wiki100_m.count"], "filters":{}, "sorts": ["wiki100_m.count desc"], "limit": "10"}

Q: "What are the states that had the most orders, filter state: California, Nevada, Washinton, Oregon"
{"field_names": ["orders.count"], "filters": {"sales_order.state": "California, Nevada, Washington, Oregon"}, "sorts": []}

Q: "What are the top 7 brands that had the most sales price in the last 4 months?"
{"field_names": [ "products.brand", "order_items.total_sale_price" ], "filters": { "order_items.created_date": "4 months" }, "pivots": [], "sorts": ["order_items.total_sale_price desc"], "limit": "7"}

"""
), null);
EOF  
    create_disposition = ""
    write_disposition  = ""
  }
  depends_on = [google_bigquery_table.table_settings]
}


resource "google_storage_bucket" "bucket-llm" {
  name          = "looker-extension-genai-${random_string.random.result}"
  location      = "us"
  uniform_bucket_level_access = true
  depends_on = [random_string.random, time_sleep.wait_after_apis_activate]
  force_destroy = true
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
  bucket = google_storage_bucket.bucket-llm.name
  source =  data.archive_file.default.output_path
  depends_on = [ data.archive_file.default , time_sleep.wait_after_apis_activate]
}

resource "google_cloudfunctions2_function" "functions_bq_remote_udf" {
  name = "looker-extension-genai-bq-remote-${random_string.random.result}"
  location = "us-central1"
  description = "Cloud Function to connect BigQuery UDF to Vertex AI text-bison"

  build_config {
    runtime = "python311"
    entry_point = "bq_vertex_remote"  # Set the entry point     
    source {
      storage_source {
        bucket = google_storage_bucket.bucket-llm.name
        object = google_storage_bucket_object.functions_bq_remote_udf.name
      }
    }
  }

  service_config {
    max_instance_count  = 20
    min_instance_count = 2
    available_memory    = "512M"    
    timeout_seconds     = 120
    ingress_settings = "ALLOW_INTERNAL_ONLY"
    service_account_email = google_service_account.looker_llm_service_account.email
  }
  depends_on = [google_storage_bucket_object.functions_bq_remote_udf, google_storage_bucket.bucket-llm, time_sleep.wait_after_apis_activate]  
}

resource "google_bigquery_job" "create_bq_remote_udf" {
  job_id = "create_looker_bq_remote_udf-${random_string.random.result}"
  query {
    query              = <<EOF
CREATE OR REPLACE FUNCTION 
`${var.project_id}`.llm.bq_vertex_remote(prompt STRING) RETURNS STRING
REMOTE WITH CONNECTION `${var.project_id}.${var.bq_region}.${var.bq_remote_connection_name}-${random_string.random.result}` 
OPTIONS (endpoint = '${google_cloudfunctions2_function.functions_bq_remote_udf.url}')
EOF  
    create_disposition = ""
    write_disposition  = ""
  }
  depends_on = [google_bigquery_connection.connection, google_bigquery_dataset.dataset, time_sleep.wait_after_apis_activate, google_cloudfunctions2_function.functions_bq_remote_udf]
}

# IAM for connection to be able to execute vertex ai queries through BQ
resource "google_project_iam_member" "bigquery_connection_invoke_function" {
  project    = var.project_id
  role       = "roles/run.invoker"
  member     = format("serviceAccount:%s", google_bigquery_connection.connection.cloud_resource[0].service_account_id)
  depends_on = [time_sleep.wait_after_apis_activate, google_bigquery_connection.connection]
}
