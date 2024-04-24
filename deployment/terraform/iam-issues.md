# Required IAM Roles for Successful Terraform Deployment

## Background

This document outlines the essential Identity and Access Management (IAM) roles necessary for the successful deployment of this extension using Terraform in an existing Google Cloud Project. These roles grant specific permissions for interacting with Google Cloud services and resources. Without the proper roles assigned, Terraform operations will fail with permission-related errors.

## Required Roles

The following IAM roles are essential for the successful deployment and operation of the Looker GenAI Extension. These roles should be assigned at the project level of your Looker GenAI Extension project:

*   `roles/browser`
*   `roles/cloudfunctions.developer`
*   `roles/iam.serviceAccountUser`
*   `roles/storage.admin`
*   `roles/bigquery.user`
*   `roles/bigquery.connectionAdmin`
*   `roles/resourcemanager.projectIamAdmin`
*   `roles/iam.serviceAccountCreator`

## Required Roles and Potential Errors

| IAM Role                                 | Error Encountered if Role is Missing                                                                                                                                                                                                                               |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `roles/storage.admin`                     | `googleapi: Error 403: [service account] does not have storage.buckets.create access... Permission 'storage.buckets.create' denied on resource (or it may not exist)`                                                                                           |
| `roles/bigquery.user`                    | `googleapi: Error 403: Access Denied: Project [project-id]: User does not have bigquery.datasets.create permission in project [project-id]`                                                                                                                         |
| `roles/bigquery.connectionAdmin`          | `googleapi: Error 403: Access Denied: Project [project-id]: User does not have bigquery.connections.create permission for project [project-id]`                                                                                                                      |
| `roles/resourcemanager.projectIamAdmin`   | `Error applying IAM policy for project "[project-id]": googleapi: Error 403: Policy update access denied` (When attempting to grant roles to other service accounts)                                                                                               |
| `roles/iam.serviceAccountCreator`        | `googleapi: Error 403: Permission 'iam.serviceAccounts.create' denied on resource (or it may not exist)`                                                                                                                                                         |
| `roles/cloudfunctions.developer`         | `googleapi: Error 403: Permission 'cloudfunctions.functions.create' denied on 'projects/[project-id]/locations/[location]/functions/[function-name]'`                                                                                                        |
| `roles/iam.serviceAccountUser`           | `googleapi: Error 403: Caller is missing permission 'iam.serviceaccounts.actAs' on service account [service-account]... Grant the role 'roles/iam.serviceAccountUser' to the caller on the service account [service-account]`                     |

## Additional Notes

*   These roles represent the minimum required permissions. Following the principle of least privilege, grant only the specific permissions needed for each task within the Looker GenAI Extension project.
*   For advanced use cases or granular control, consider using custom IAM roles tailored to your specific requirements.

## Troubleshooting

If you encounter permission errors not listed here, carefully examine the error message to identify the required permission and then assign the appropriate IAM role. Google Cloud's IAM documentation provides detailed information on available roles and permissions.
