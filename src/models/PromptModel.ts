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
