import vertexai
import functions_framework
import logging
from flask import jsonify
from vertexai.preview.language_models import TextGenerationModel
import os
import json
 

PROJECT_ID = os.environ.get("PROJECT_ID", "PROJECT_ID") # @param {type:"string"}
LOCATION = os.environ.get("LOCATION", "us-central1")  # @param {type:"string"}
TUNED_MODEL_URL = os.environ.get("TUNED_MODEL_URL", "projects/94990521171/locations/us-central1/models/6076193725183164416")
CHAR_PER_TOKEN = 4

vertexai.init(project=PROJECT_ID, location=LOCATION)

# Max INT64 value encoded as a number in JSON by TO_JSON_STRING. Larger values are encoded as
# strings.
# See https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_encodings

with open('base_prompt.txt') as f: base_prompt = f.read()
with open('prompt.txt') as f: prompt = f.read()
with open('prompt2.txt') as f: prompt2 = f.read()

@functions_framework.http
def bq_vertex_remote(request):
  try:
    return_value = []
    request_json = request.get_json()
    calls = request_json['calls']
    tuned_model = TextGenerationModel.get_tuned_model(TUNED_MODEL_URL)    
    for call in calls:
      if call is not None and len(call) == 1:
        prompt = call[0]
        logging.info("Prompt: " + prompt)
        # Get everything after the string "input_dictionary"
        dictionary_string = prompt[len("input_dictionary"):]
        
        # Pega Json, quebra em chunks e reprocessa; 
        if(isinstance(prompt, str)):
          genai_return = tuned_model.predict(
            prompt=prompt,
            temperature= 0.2,
            max_output_tokens= 1024,
            top_p= 0.8,
            top_k= 40
            )
          return_value.append(genai_return)
        else:
            #   error, receiving more 
            logging.error("Receiving more than one element or null")
            return_value.append(None)

    replies = [str(x) for x in return_value]
    return jsonify( { "replies" :  replies } )
  except Exception as e:
    return jsonify( { "errorMessage": str(e) } ), 400  

def test_logic():
  start_index = prompt.find(" input_dictionary : ")
  end_index = start_index + len(" input_dictionary : ")
  dictionary_string = prompt[end_index:]
  dict_json_fields = json.loads(dictionary_string)
  dict_table_fields = {}
  total_tokens = 0
  for json_dict in dict_json_fields:    
    estimated_token = len(json.dumps(json_dict))/CHAR_PER_TOKEN
    table_name = json_dict["field"].split('.', 1)[0]
    dict_table_fields[table_name] = dict_table_fields.get(table_name, [])
    dict_table_fields[table_name].append(json_dict)
    total_tokens += estimated_token
  prompt_chunks = []
  current_chunk_index = 0
  current_chunk_size = 0
  max_chunk_size = 6000
  for table_name, table_fields in dict_table_fields.items():
    estimated_size = len(json.dumps(table_fields)) / CHAR_PER_TOKEN
    if (estimated_size > max_chunk_size):
      print(table_name, estimated_size, "(can't fit)")
      for field in table_fields:
        estimated_field_size = len(json.dumps(field)) / CHAR_PER_TOKEN
        if (estimated_field_size + current_chunk_size > max_chunk_size):
          print("\tcreating new chunk", current_chunk_index, current_chunk_size)
          current_chunk_index += 1
          current_chunk_size = 0
        if (len(prompt_chunks) - 1 < current_chunk_index):
          prompt_chunks.append([])
        prompt_chunks[current_chunk_index].append(field)
        current_chunk_size += estimated_field_size
      continue
    if (estimated_size + current_chunk_size > max_chunk_size):
      print("\tcreating new chunk", current_chunk_index, current_chunk_size)
      current_chunk_index += 1
      current_chunk_size = 0
    if (len(prompt_chunks) - 1 < current_chunk_index):
      prompt_chunks.append([])
    prompt_chunks[current_chunk_index] += table_fields
    current_chunk_size += estimated_size
    print(table_name, estimated_size)
  # print(total_tokens)
  print("total chunks", len(prompt_chunks))
  # Input: Qual as vendas por categoria por mes?    \n    input_dictionary :
  tuned_model = TextGenerationModel.get_tuned_model(TUNED_MODEL_URL)
  for chunk_fields in prompt_chunks:
    serialized_chunk_fields = json.dumps(chunk_fields)
    current_prompt = f"{base_prompt} Input: Qual as vendas por categoria por mes? \\n input_dictionary: {serialized_chunk_fields}".encode("unicode_escape").decode("utf-8")
    print("PROMPT=", current_prompt)
    genai_return = tuned_model.predict(
        prompt=current_prompt,
        temperature= 0.2,
        max_output_tokens= 1024,
        top_p= 0.8,
        top_k= 40
    )
    print("RETURN=", genai_return)
    break


  
  
test_logic()

def another_function():
  print(len(prompt))

# another_function()
