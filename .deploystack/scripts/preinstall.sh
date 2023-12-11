#!/bin/sh
export PROJECT_ID=$(gcloud config get-value project)
echo "ProjectId: $PROJECT_ID"
gcloud services enable cloudresourcemanager.googleapis.com
export BUCKET_PREFIX="looker-gen-ai-tf-state-"
export BUCKET_NAME="$BUCKET_PREFIX$PROJECT_ID"
# Check if the bucket exists
gsutil ls -b gs://$BUCKET_NAME

# If the bucket does not exist, create it
if [ $? -ne 0 ]; then
 gsutil mb gs://$BUCKET_NAME
 echo "Bucket $BUCKET_NAME created."
else
 echo "Bucket $BUCKET_NAME already exists."
fi

sed -i "s/{PROJECTID}/$PROJECT_ID/g" ./deployment/main.tf
echo "Replacing project id on main.tf"

