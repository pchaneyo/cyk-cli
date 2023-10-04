import { Cmd } from "./Cmd";
import { DBClient } from "./DBClient";
import { logger } from "./TableCommand";

//--------------------------------------------------------------------------------------------------------------------
// class TableData
//--------------------------------------------------------------------------------------------------------------------
export class TableDataCommand extends Cmd {

    constructor(name: string, description: string) {
        super(name);
        this.description(description)
            .argument('<table>', 'table name')
            .option('--where <clause_where_sql>', 'criteria in SQL syntax')
            .option('-s --sort <columns>', 'sort by columns positions (begins by 0) separated by comma')
            .option('-w --width <colwidth>', 'columns widths separated by comma')
            .action(async (table, options) => {
                this.commandData(table, options);
            });
    }

    async commandData(table: string, options: any) {
        try {
            await this.prologue(options);
            if (this.dbManager === undefined) throw 'dbManager undefined';

            const dbTable = await this.dbManager.dbTableExist(table);
            if (dbTable === undefined) throw 'table ' + table + ' not found';

            let fields = '';

            for (let ind = 0; ind < dbTable.columns.length; ind++) {
                const dbColumn = dbTable.columns[ind];
                let ok = false;
                let fieldName = dbColumn.name;
                if (dbColumn.dbType === 'text' || dbColumn.dbType === 'bytea') {
                    ok = false;
                    fieldName = 'length(' + dbColumn.name + ')';
                }
                else {
                    ok = true;
                }
                if (ok === true) {
                    if (fields !== '') fields += ',';
                    fields += fieldName;
                }
            }

            logger.debug('commandQuery', table);
            const dbClient = new DBClient(this.dbManager);
            let title = 'Table ' + table;
            if (options.where !== undefined) {
                title += ' where ' + options.where;
            }
            dbClient.selectFromTable(title, table,
                { fields: fields, width: options.width, sort: options.sort || '1', where: options.where });
        }
        catch (err) {
            logger.error(err);
        }
    }
}
