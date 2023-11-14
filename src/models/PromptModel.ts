/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import Joi from 'joi';
import { BaseSchema, Schemafy } from "./Schema";

const schema: Schemafy<IPromptModel> = {
    description: Joi.string().required(),
    prompt: Joi.string().required(),
    modelExplore: Joi.string().required().pattern(/.*\..*/)
};

export interface IPromptModel {
    description: string,    
    prompt: string,
    modelExplore: string
}

interface PromptModel extends IPromptModel {}

class PromptModel extends BaseSchema {
    constructor(init: IPromptModel) {
        super(init);
    }

}

export default PromptModel;
