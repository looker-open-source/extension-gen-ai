import Joi from 'joi';
import { UtilsHelper } from '../utils/Helper';
import { BaseSchema, Schemafy } from "./Schema";


export interface ILookerExploreDataModel {
    fields: string[],
    filters: { [key: string]: string },
    pivots: string[],
    explicit_pivots?: string[],
    sorts: string[],
    limit?: string,
}

interface LookerExploreDataModel extends ILookerExploreDataModel {}

class LookerExploreDataModel extends BaseSchema {
    constructor(init: ILookerExploreDataModel, allowedFields: string[]) {
        super(init);
        this.validate(allowedFields);
    }

    public merge(exploreData: LookerExploreDataModel) {
        const { fields, pivots, sorts, filters, limit } = exploreData;
        if (fields) {
            this.fields = this.fields.concat(fields);
        }
        if (pivots) {
            // bring the pivots also to the fields
            this.fields = this.fields.concat(pivots);
            this.pivots = this.pivots.concat(pivots);
        }
        if (sorts) {
            this.sorts = this.sorts.concat(sorts);
        }
        if (filters)
        {
            this.filters = {
                ...this.filters,
                ...filters
            };
        }
        // overwriting limit
        if (limit) {
            this.limit = limit;
        }
    }

    public validate(allowedFields: string[]) {
        this.removeDuplicates();
        const schema = this.generateSchema(allowedFields);
        super.schemafyValidation(schema);
    }

    private removeDuplicates() {
        if (this.fields) {
            this.fields = UtilsHelper.removeDuplicates(this.fields);
        }
        if (this.pivots) {
            this.pivots = UtilsHelper.removeDuplicates(this.pivots);
        }
        if (this.sorts) {
            this.sorts = UtilsHelper.removeDuplicates(this.sorts);
        }
    }

    private generateSchema(allowedFields: string[]): Schemafy<ILookerExploreDataModel> {
        const schema: Schemafy<ILookerExploreDataModel> = {
            fields: Joi.array().required().unique().items(Joi.string().valid(...allowedFields)),
            filters: Joi.object().required().pattern(Joi.string(), Joi.string()),
            pivots: Joi.array().required().items(Joi.string()),
            explicit_pivots: Joi.array().items(Joi.string()),
            sorts: Joi.array().required().items(Joi.string()),
            limit: Joi.string(),
        };
        return schema;
    }
}

export default LookerExploreDataModel;
