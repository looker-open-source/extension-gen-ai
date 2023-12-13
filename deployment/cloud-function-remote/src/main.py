import vertexai
import functions_framework
import logging
from flask import jsonify
from vertexai.preview.language_models import TextGenerationModel
from time import time


LOCATION = "us-central1"  # @param {type:"string"}

vertexai.init(location=LOCATION)
vertex_model = TextGenerationModel.from_pretrained("text-bison-32k")
# vertex_model_8k = TextGenerationModel.from_pretrained("text-bison")
# vertex_model = TextGenerationModel.get_tuned_model('projects/XXXXXX/locations/us-central1/models/XXXXXXXXXXXXXX')    

# Max INT64 value encoded as a number in JSON by TO_JSON_STRING. Larger values are encoded as
# strings.
# See https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_encodings

@functions_framework.http
def bq_vertex_remote(request):
  try:
    return_value = []
    request_json = request.get_json()
    calls = request_json['calls']

    for call in calls:
      if call is not None and len(call) == 1:
        prompt = call[0]
        logging.info("Prompt: " + prompt)        
        if(isinstance(prompt, str)):
          start_time = time()
          genai_return = vertex_model.predict(
            prompt=prompt,
            temperature= 0.05,
            max_output_tokens= 1024,
            top_p= 0.8,
            top_k= 40
            )
          end_time = time()
          elapsed_time = end_time - start_time
          print("Elapsed time: " + str(elapsed_time))
          return_value.append(genai_return.text)
        else:
            #   error, receiving more 
            print("Receiving more than one element or null")
            return_value.append(None)

    replies = [str(x) for x in return_value]
    return jsonify( { "replies" :  replies } )
  except Exception as e:
    return jsonify( { "errorMessage": str(e) } ), 400
          
            
          

