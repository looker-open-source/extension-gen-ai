project_name: "looker-genai"

# # Use local_dependency: To enable referencing of another project
# # on this instance with include: statements
#
# local_dependency: {
#   project: "name_of_other_project"
# }
application: looker-genai {
  label: "looker-genai"
  url: "https://localhost:8080/bundle.js"

  # file: "bundle.js
  entitlements: {
    use_embeds: yes
    use_form_submit: yes
    use_iframes: yes
    external_api_urls: ["https://localhost:8080","http://localhost:8080"]
    core_api_methods: ["run_inline_query", "me", "all_looks", "run_look", "all_lookml_models", "run_sql_query", "create_sql_query", "lookml_model_explore", "create_query", "use_iframes", "use_embeds",  "use_form_submit"] #Add more entitlements here as you develop new functionality
  }
}

constant: CONNECTION_NAME {
  value: "dataml-latam-argolis"
  export: override_required
}

