export class UtilsHelper {
    public static escapeBreakLine(originalString: string): string {
        return originalString
            .replace(/\n/g, '\\n');
    }

    public static escapeSpecialCharacter(originalString: string): string {
        return originalString
            .replace(/\'/g, '\\\'');
    }


    public static firstElement<T>(array: Array<T>): T {
        const [ firstElement ] = array;
        return firstElement;
    }

    public static removeDuplicates<T>(array: Array<T>): Array<T> {
        return Array.from(new Set(array));
    }
}
