/**
 * Copyright (c) 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

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
}
