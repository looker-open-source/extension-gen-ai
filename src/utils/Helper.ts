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
