#!/bin/sh
export PROJECT_ID=$(gcloud config get-value project)
echo "selecting active project ($PROJECT_ID)..."
echo "making sure cloud resource manager service is enabled..."
gcloud services enable cloudresourcemanager.googleapis.com
export BUCKET_PREFIX="looker-gen-ai-tf-state-"
export BUCKET_NAME="$BUCKET_PREFIX$PROJECT_ID"
# Check if the bucket exists
gsutil ls -b gs://$BUCKET_NAME
echo "checking if tf state bucket exists ($BUCKET_NAME)"
# If the bucket does not exist, create it
if [ $? -ne 0 ]; then
 gsutil mb gs://$BUCKET_NAME
 echo "bucket $BUCKET_NAME was created..."
else
 echo "bucket $BUCKET_NAME already exists..."
fi
sed -i "s/{STATE_BUCKET_NAME}/$BUCKET_NAME/g" ./deployment/main.tf
echo "Replacing project id on main.tf"

