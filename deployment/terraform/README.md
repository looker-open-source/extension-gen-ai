## Terraform 
This terraform script will help setup the required infrastructure resources for the extension in a GCP Project:
- BigQuery Dataset (default name: llm)
- BigQuery Remote Model pointing to Palm API (llm_model)
- IAM Service Accounts to create a connection to Looker
- IAM permission for BQ connection to connect to Vertex AI
  
