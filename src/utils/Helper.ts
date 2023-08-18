export class UtilsHelper {
    public static escapeBreakLine(originalString: string): string {
        return originalString
            .replace(/\n/g, '\\n');
    }

    public static escapeSpecialCharacter(originalString: string): string {
        // Fix Query with Escaping Single quote that is not escaped
        let fixedString = originalString;
        // TODO: replace only when not already escaped
        // const regex = /'(?!\\)/g;
        // fixedString = originalString.replace(regex, "\\'");
        fixedString = fixedString.replace(/\'/g, "\\'");
        return fixedString;
    }



    public static firstElement<T>(array: Array<T>): T {
        const [ firstElement ] = array;
        return firstElement;
    }
}
