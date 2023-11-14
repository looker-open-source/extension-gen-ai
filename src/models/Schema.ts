/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
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
