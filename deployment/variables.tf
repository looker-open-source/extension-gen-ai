variable "project_id" {
  type = string
}
variable "training_region"{
  type = string
  default = "europe-west4"
}

variable "deployment_region" {
  type = string
  default = "us-central1"
}

variable "bq_remote_connection_name"{
  type = string
  default = "bqllm"
}

variable "bq_region"{
  type = string
  default = "US"
}

provider "google" {
  project = var.project_id
  region = var.deployment_region
}

variable "dataset_id_name"{
  type = string
  default = "llm"
}

