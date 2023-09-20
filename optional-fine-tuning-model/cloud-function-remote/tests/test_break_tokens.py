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

import vertexai
import functions_framework
import logging
from flask import jsonify
from vertexai.preview.language_models import TextGenerationModel
import os
import json
 

PROJECT_ID = os.environ.get("PROJECT_ID", "dataml-latam-argolis") # @param {type:"string"}
LOCATION = os.environ.get("LOCATION", "us-central1")  # @param {type:"string"}
TUNED_MODEL_URL = os.environ.get("TUNED_MODEL_URL", "projects/94990521171/locations/us-central1/models/6076193725183164416")
CHAR_PER_TOKEN = 4

vertexai.init(project=PROJECT_ID, location=LOCATION)

# Max INT64 value encoded as a number in JSON by TO_JSON_STRING. Larger values are encoded as
# strings.
# See https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_encodings

with open('base_prompt.txt') as f: base_prompt = f.read()
with open('prompt.txt') as f: prompt3 = f.read()
with open('prompt2.txt') as f: prompt2 = f.read()
with open('prompt3.txt') as f: prompt = f.read()
with open('fulldict.json') as f: full_dict_txt = f.read()

full_dict = json.loads(full_dict_txt)

def run_prompt2():
  tuned_model = TextGenerationModel.get_tuned_model(TUNED_MODEL_URL)    
  genai_return = tuned_model.predict()




def run_prompt():
  tuned_model = TextGenerationModel.from_pretrained("text-bison@001")
  final_prompt = prompt.replace("{input_dictionary}",json.dumps(full_dict[101:120]))
  print(final_prompt)
  genai_return = tuned_model.predict(
            prompt=final_prompt,
            temperature= 0,
            max_output_tokens= 1024,
            top_p= 0,
            top_k= 1
            )
  print(genai_return)


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
    new_base = base_prompt.replace('\\n', "\n")
    current_prompt = f"\n    {new_base}\n    Input: What is the billing reference document number xvlbr count?\n    input_dictionary: {serialized_chunk_fields}\n"
        
    print("PROMPT=", current_prompt)
#     current_prompt = '''
# \n    Return ONLY a simple JSON body for Looker LLM application.\n    Make sure to use the following 3 rules:\n    1. The JSON has a structure of model (string), view(string), fields(array of strings), filters(array of strings), sorts(array of strings), pivots(array of strings), limit(int).\n    2. All the fields, sorts, pivots need to be in the dictionary provided for the input.    \n    3. Use syntax compatible with Looker matching filters with data types.\n\n    Here are some generic examples that uses a example_input_dictionary with model: "bi_engine_demo" and view: "wiki100_m", so you can learn how does it works:\n    example_input_dictionary : [{"label":"Wiki100 M Day","field":"wiki100_m.day","description":""},{"label":"Wiki100 M Language","field":"wiki100_m.language","description":""},{"label":"Wiki100 M Month","field":"wiki100_m.month","description":""},{"label":"Wiki100 M Title","field":"wiki100_m.title","description":""},{"label":"Wiki100 M Views","field":"wiki100_m.views","description":""},{"label":"Wiki100 M Wikimedia Project","field":"wiki100_m.wikimedia_project","description":""},{"label":"Wiki100 M Year","field":"wiki100_m.year","description":""},{"label":"Wiki100 M Count","field":"wiki100_m.count","description":""}]\n    \n    input: What are the top 10 languages?\n    output: {"model": "bi_engine_demo", "view": "wiki100_m", "fields": ["wiki100_m.count", "wiki100_m.language"], "filters": null, "sorts": ["wiki100_m.count desc"], "pivots": null, "limit": "10"}\n\n    input: count per language in year 2023\n    output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language","wiki100_m.year"],"filters": { "wiki100_m.year": "2023"}, "sorts": [],"pivots": null,"limit": "500"}\n\n    input: count per language pivot per year order by year desc\n    output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language","wiki100_m.year"],"filters": null, "sorts": ["wiki100_m.year desc],"pivots": ["wiki100_m.year"],"limit": "500"}\n\n    input:  What is the count per language, year, considering the folowing languages: en,pt,es?\n    output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language", "wiki100_m.year"],"filters": {"wiki100_m.language": "en,fr,es"}, "sorts": null,"pivots": ["wiki100_m.year"],"limit": "500"}\n\n    Now, generate the output with model: thelook and view: "products".\n    Make sure to use data from the input_dictionary to select filters, sorts and pivots.     \n    input_dictionary : [{"label":"Products Brand","field":"products.brand","description":""},{"label":"Products Category","field":"products.category","description":""},{"label":"Products Department","field":"products.department","description":""},{"label":"Products ID","field":"products.id","description":""},{"label":"Products Item Name","field":"products.item_name","description":""},{"label":"Products Rank","field":"products.rank","description":""},{"label":"Products Retail Price","field":"products.retail_price","description":""},{"label":"Products SKU","field":"products.sku","description":""},{"label":"Products Count","field":"products.count","description":""}]    \n    Input: give me the price of all products\n    \n  
# '''
#     print("CURRENT PROMPT = ", current_prompt)
    genai_return = tuned_model.predict(
        prompt=current_prompt,
        temperature= 0.2,
        max_output_tokens= 1024,
        top_p= 0.8,
        top_k= 40
    )
    print("Teste de retorno")
    print(genai_return)
    break


  

run_prompt()
# test_logic()

# def another_function():
#   print(len(prompt))

# another_function()
