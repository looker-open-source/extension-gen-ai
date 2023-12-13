import vertexai
import functions_framework
import logging
from flask import jsonify
from vertexai.preview.language_models import TextGenerationModel
from vertexai.preview.generative_models import GenerativeModel, Part

import json

from time import time

GEMINI = True
LOCATION = "us-central1"  # @param {type:"string"}
vertexai.init(location=LOCATION)


if(GEMINI):
  gemini_pro_model = GenerativeModel("gemini-pro")
else:
  vertex_model = TextGenerationModel.from_pretrained("text-bison-32k")

# vertex_model_8k = TextGenerationModel.from_pretrained("text-bison")
# vertex_model = TextGenerationModel.get_tuned_model('projects/XXXXXX/locations/us-central1/models/XXXXXXXXXXXXXX')    
# Max INT64 value encoded as a number in JSON by TO_JSON_STRING. Larger values are encoded as
# strings.
# See https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_encodings


def get_model_result(prompt):
  if(GEMINI):
    genai_responses = gemini_pro_model.generate_content(
    prompt,
    generation_config={
        "temperature": 0.05,
        "max_output_tokens": 1024,
        "top_p": 1.0,
        "top_k": 40,
    },
    stream=False)
    return genai_responses.candidates[0].content.parts[0].text
  else:
    genai_return = vertex_model.predict(
    prompt=prompt,
    temperature= 0.05,
    max_output_tokens= 1024,
    top_p= 0.8,
    top_k= 40
    )
    return genai_return.text

@functions_framework.http
def bq_vertex_remote(request):
  try:
    return_value = []
    request_json = request.get_json()
    calls = request_json['calls']

    for call in calls:
      if call is not None and len(call) == 1:
        prompt = call[0]
        print(gemini_pro_model.count_tokens(prompt))     
        if(isinstance(prompt, str)):
          start_time = time()
          genai_responses = get_model_result(prompt)
          end_time = time()
          elapsed_time = end_time - start_time
          print("Elapsed time: " + str(elapsed_time))
          return_value.append(genai_responses.candidates[0].content.parts[0].text)          
        else:
            #   error, receiving more 
            print("Receiving more than one element or null")
            return_value.append(None)

    replies = [str(x) for x in return_value]
    return jsonify( { "replies" :  replies } )
  except Exception as e:
    print(str(e))
    return jsonify( { "errorMessage": str(e) } ), 400
          