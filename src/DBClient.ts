import { BasicType, DBColumn, DBExecuteRequest, DBManager, DBTable, ObjectData, parseXML, PrimitiveData } from "@cyklang/core";
import loglevel from "loglevel";
const logger = loglevel.getLogger('DBClient.ts')
logger.setLevel('debug')
// DBManager wrapper class

export class DBClient {
    dbManager: DBManager
    constructor(dbManager: DBManager) {
        this.dbManager = dbManager
    }

    async selectFromTable(title: string, tableName: string, options:
        { fields: string, sort?: string | undefined, where?: string | undefined }) {

        try {

            const objectDataType = this.dbManager.scope.structure.objectDataType;
            const stringDataType = this.dbManager.scope.structure.stringDataType
            const request = new DBExecuteRequest()
            request.selectFromTable = tableName

            request.parameters.addVariable('fields', stringDataType).data = new PrimitiveData(stringDataType, options.fields)
            request.parameters.addVariable('where', stringDataType).data = new PrimitiveData(stringDataType, options.where)
            if (options.sort !== undefined) {
                const colnames = options.fields.split(',')
                const sortcols = options.sort.split(',')
                let order_by = ''
                for (let ind = 0; ind < sortcols.length; ind++ ) {
                    const coli = sortcols[ind]
                    const colname = colnames[Number(coli)]
                    if (order_by !== '') order_by += ','
                    order_by += colname
                }
                logger.debug('order_by '+order_by)
                request.parameters.addVariable('order_by', stringDataType).data = new PrimitiveData(stringDataType, order_by)
            }

            // if (options !== undefined) {
            //     Object.entries(options).forEach(([key, value]) => {
            //         const data = new PrimitiveData(stringDataType, value)
            //         request.parameters.addVariable(key, stringDataType).data = data
            //     })
            // }
    
            const xmlResult = await this.dbManager.dbExecute(request)
            if (xmlResult === undefined) throw 'xmlResult undefined'
            const tagXmlResult = parseXML('xmlResult', xmlResult)
    
            const objXmlResult = (await objectDataType.parseData(tagXmlResult, this.dbManager.scope)) as ObjectData
            const objectMeta = (objXmlResult.variables.getData('meta')) as ObjectData
            if (objectMeta === undefined) throw 'objectMeta not found'
            const xmlMeta = objectMeta.variables.getString(tableName)
            if (xmlMeta === undefined) throw 'meta does not have ' + tableName + ' description'
    
            const tagDBTable = parseXML('dbTable', xmlMeta)
            const dbTable = new DBTable(tagDBTable)
    
            const fields = options.fields.split(',')
            const list = new List()
    
            for (let ind = 0; ind < fields.length; ind++) {
                const field = fields[ind]
                const dbColumn = dbTable.columns.filter((dbColumn) => dbColumn.name === field)[0]
                if (dbColumn === undefined) throw 'field ' + field + ' not found'
                list.addDBColumn(dbColumn)
            }
    
            const objDataset = objXmlResult.variables.getData(tableName) as ObjectData
            for (let ind = 0; ind < objDataset.variables.length(); ind++) {
                const record = (objDataset.variables.at(ind)?.data as ObjectData)
                list.addObjectData(record)
            }
            logger.info(list.renderList(title))
            
        }
        catch (err) {
            logger.error(err)
        }
    }
}

class List {
    columns: Column[] = []
    rows: Row[] = []
    lines: string[] = []
    currentLine: string = ''

    addDBColumn(dbColumn: DBColumn) {
        const col = new Column(dbColumn.name)
        col.label = dbColumn.label || dbColumn.name
        col.dbColumn = dbColumn
        this.columns.push(col)
    }

    addObjectData(objectData: ObjectData) {
        const cells: BasicType[] = []
        this.columns.forEach((column) => {
            let cell: BasicType = undefined
            const data = objectData.variables.getData(column.name)
            if (data !== undefined && data !== null) {
                cell = (data as PrimitiveData).value
            }
            cells.push(cell)
        })
        this.rows.push(new Row(cells))
    }

    renderList(title: string): string {
        // calculate column.width
        let total_width = 0
        for (let indi = 0; indi < this.columns.length; indi++) {
            const column = this.columns[indi]
            column.width = column.label.length
            this.rows.forEach((row) => {
                const cell = row.cells[indi]
                const renderedCell = this.renderCell(cell)
                if (renderedCell.length > column.width) {
                    column.width = renderedCell.length
                }
            })
            if (total_width > 0) total_width += 3
            total_width += column.width
        }

        // title
        this.lines.push(this.renderCell(title, total_width, 'center'))

        // header
        this.lines.push(this.renderHeaderRow())
        this.lines.push(this.renderSeparator())

        // rows
        for (let indj = 0; indj < this.rows.length; indj++ ) {
            const row = this.rows[indj]
            this.lines.push(this.renderRow(row))
        }
        return this.lines.join('\n')
    }

    renderHeaderRow(): string {
        let result = ''
        for (let indi = 0; indi < this.columns.length; indi++ ) {
            const column = this.columns[indi]
            if (result !== '') result += ' | '
            result += this.renderCell(column.label, column.width, 'center')
        }
        return result
    }

    renderRow(row: Row): string {
        let result = ''
        for (let indi = 0; indi < this.columns.length; indi++ ) {
            const column = this.columns[indi]
            let justify: 'left' | 'right' | 'center' | undefined = 'left'
            if (column.dbColumn?.dataTypeName === 'number' || column?.type === 'number') {
                justify = 'right'
            }
            if (result !== '') result += ' | '
            result += this.renderCell(row.cells[indi], column.width, justify)
        }
        return result
    }

    renderSeparator(): string {
        let result = ''
        for ( let indi = 0; indi < this.columns.length; indi++ ) {
            const column = this.columns[indi]
            if (result !== '') result += '-+-'
            result += '-'.repeat(column.width)
        }
        return result
    }

    renderCell(value: BasicType, width?: number | undefined, justify?: 'left' | 'right' | 'center' | undefined): string {
        let result: string
        if (value === undefined) {
            result = ''
        }
        else if (value === null) {
            result = 'null'
        }
        else {
            result = value.toString()
        }
        if (width !== undefined && result.length < width) {
            if (justify === undefined || justify === 'left') {
                result += ' '.repeat(width - result.length)
            }
            else if (justify === 'right') {
                result = ' '.repeat(width - result.length) + result
            }
            else {
                // justify === center
                const before = Math.floor((width - result.length) / 2)
                result = ' '.repeat(before) + result + ' '.repeat(width - result.length - before)
            }
        }
        return result
    }
}

class Column {
    name: string;
    label: string = '';
    dbColumn: DBColumn | undefined;
    type?: string | undefined;
    computed?: string | undefined;
    width: number = 0
    constructor(name: string) {
        this.name = name
    }
}

class Row {
    cells: BasicType[]
    constructor(cells: BasicType[]) {
        this.cells = cells
    }
}
