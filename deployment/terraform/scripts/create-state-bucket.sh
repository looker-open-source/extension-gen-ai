#!/bin/sh
PROJECT_ID=$(gcloud config get-value project)
echo "selecting active project ($PROJECT_ID)..."
echo "making sure cloud resource manager service is enabled..."
gcloud services enable cloudresourcemanager.googleapis.com
BUCKET_PREFIX="looker-gen-ai-tf-state-"
BUCKET_NAME="$BUCKET_PREFIX$PROJECT_ID"
PROVIDER_FILE_PATH="./provider.tf"
echo "checking if tf state bucket exists ($BUCKET_NAME)"
# If the bucket does not exist, create it
if ! gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
   gsutil mb "gs://$BUCKET_NAME"
   echo "Bucket created successfully!"
else
   echo "Bucket already exists."
fi 

echo "adding gcs backend configuration to $PROVIDER_FILE_PATH"
cat > $PROVIDER_FILE_PATH <<- EOM
terraform {
  backend "gcs" {
    bucket = "$BUCKET_NAME" # this gets replaced by scripts/create-state-bucket.sh
  }
}
EOM
