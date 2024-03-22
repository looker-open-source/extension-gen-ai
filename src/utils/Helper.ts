/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { ConfigReader } from "../services/ConfigReader";

export interface IDictionary<T> {
    [key: string]: T;
}

export class UtilsHelper {
    /**
     * Adds an extra slash to line breaks \n -> \\n
     * @param originalString
     * @returns
     */
    public static escapeBreakLine(originalString: string): string {
        return originalString
            .replace(/\n/g, '\\n');
    }

    public static escapeQueryAll(originalString:string): string {
        return UtilsHelper.escapeSpecialCharacter(UtilsHelper.escapeBreakLine(originalString));
    }

    /**
     * Adds an extra slash to line breaks \n -> \\n
     * @param originalString
     * @returns
     */
    public static escapeSpecialCharacter(originalString: string): string {
        let fixedString = originalString;
        fixedString = fixedString.replace(/\'/g, "\\'");
        return fixedString;
    }

    /**
     * Returns first element from Array
     * @param array
     * @returns
     */
    public static firstElement<T>(array: Array<T>): T {
        const [ firstElement ] = array;
        return firstElement;
    }

    /**
     * Replaces ```JSON with ```
     * @param originalString
     * @returns
     */
    public static cleanResult(originalString: string): string {
        let fixedString = originalString;
        fixedString = fixedString.replace("```json", "");
        fixedString = fixedString.replace("```JSON", "");
        fixedString = fixedString.replace("```", "");
        return fixedString;
    }

    /**
     * Remove duplicates from Array
     * @param array
     * @returns
     */
    public static removeDuplicates<T>(array: Array<T>): Array<T> {
        return Array.from(new Set(array));
    }

    public static isNumber = (value: any) => isNaN(Number(value)) === false;

    public static enumToArray(enumerator: any): string[] {
        return Object.keys(enumerator)
            .filter(this.isNumber)
            .map(key => enumerator[key]);
    }

    public static getQueryFromPrompt(prompt: string, useNativeBQ: boolean, promptType: string = "UNSET")
    {
        if(useNativeBQ == false)
        {            
            return `#Looker Ext GenAI UDF - ${promptType} - v: ${ConfigReader.CURRENT_VERSION}
SELECT llm.bq_vertex_remote('${prompt}') AS r, '' AS status`;
        }
        return `#Looker Ext GenAI - ${promptType} - v: ${ConfigReader.CURRENT_VERSION}
SELECT ml_generate_text_llm_result as r, ml_generate_text_status as status
FROM
ML.GENERATE_TEXT(
    MODEL ${ConfigReader.BQML_MODEL},
    (
        SELECT '${prompt}' AS prompt
    ),
    STRUCT(
    0.05 AS temperature,
    1024 AS max_output_tokens,
    0.98 AS top_p,
    TRUE AS flatten_json_output,
    1 AS top_k));`;
    }
}
