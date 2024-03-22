/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import Joi from 'joi';
import { BaseSchema, Schemafy } from "./Schema";

const schema: Schemafy<ILookerExploreQueryModel> = {
    clientId: Joi.string().required(),
    queryId: Joi.string().required(),
    modelName: Joi.string().required(),
    viewName: Joi.string().required(),
};

export interface ILookerExploreQueryModel {
    clientId: string,
    queryId: string,
    modelName: string,
    viewName: string,
}

interface LookerExploreQueryModel extends ILookerExploreQueryModel {}

class LookerExploreQueryModel extends BaseSchema {
    constructor(init: ILookerExploreQueryModel) {
        super(init);
        super.schemafyValidation(schema);
    }

    public generateExploreURL(hostname: string) {
        return `${hostname}/embed/explore/${this.modelName}/${this.viewName}?qid=${this.clientId}`;
    }
}

export default LookerExploreQueryModel;
