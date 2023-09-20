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

import Joi, { Schema } from 'joi';
import { SchemaMap, ValidationOptions } from 'joi';

type FunctionTypes = Function | undefined;
export type NonFunctionKeys<T> = ({ [K in keyof T]: T[K] extends FunctionTypes ? never : K })[keyof T];
export type Schemafy<T> = {[P in NonFunctionKeys<T>]: Schema | Schema[]};

export abstract class BaseSchema {
    constructor(init: Object) {
        Object.assign(this, init);
    }

    /**
     * validates current class scope using an joi SchemaMap
     * @param schema
     */
    protected schemafyValidation(schema: SchemaMap, obj?: any, options?: ValidationOptions) {
        const joiSchema = Joi.object(schema);
        const result = joiSchema.validate(obj || this, {
            allowUnknown: true,
            stripUnknown: {
                arrays: true,
                objects: true,
            }, // strip values that are not included in schema
            abortEarly: false, // return all errors
            ...options
        });
        // checking for validation errors ...
        if (result.error) {
            throw new Error(result.error.message);
        }
        // make sure we have a clear scope so we actually strip unknown props
        this.schemafyClear();
        // update scope using result with unknow props stripped
        Object.assign(this, result.value);
    }

    /**
     * clears all defined properties from class scope
     */
    protected schemafyClear() {
        Object.keys(this).forEach((key) => delete this[key]);
    }
}
