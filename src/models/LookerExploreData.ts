import Joi from 'joi';
import { UtilsHelper } from '../utils/Helper';
import { BaseSchema, Schemafy } from "./Schema";


export interface ILookerExploreDataModel {
    field_names: string[],
    filters: { [key: string]: string },
    pivots?: string[],
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
        const { field_names, pivots, sorts, filters, limit } = exploreData;
        if (field_names) {
            this.field_names = this.field_names.concat(field_names);
        }
        if (pivots) {
            // bring the pivots also to the fields
            this.field_names = this.field_names.concat(pivots);
            if(this.pivots == null)
            {
                this.pivots = [];
            }
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
        if (this.field_names) {
            this.field_names = UtilsHelper.removeDuplicates(this.field_names);
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
            field_names: Joi.array().required().unique().items(Joi.string().valid(...allowedFields)),
            filters: Joi.object().required().pattern(Joi.string(), Joi.string()),
            pivots: Joi.array().optional().unique().items(Joi.string()),
            sorts: Joi.array().required().items(Joi.string()),
            limit: Joi.string(),
        };
        return schema;
    }
}

export default LookerExploreDataModel;
