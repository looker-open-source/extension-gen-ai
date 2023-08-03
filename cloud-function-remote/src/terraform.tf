 ## This creates a cloud resource connection.
 ## Note: The cloud resource nested object has only one output only field - serviceAccountId.
 resource "google_bigquery_connection" "connection" {
    connection_id = "bqremote"
    project = "dataml-latam-argolis"
    location = "us-central1"
    cloud_resource {}
}   