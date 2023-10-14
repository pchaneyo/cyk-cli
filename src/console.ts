import { XmlError } from '@cyklang/core'
import * as fs from "fs"
import { Instruction, InstructionType, Tag } from '@cyklang/core'
import { Data, Scope } from '@cyklang/core'
import { Expression } from '@cyklang/core'
import * as loglevel from "loglevel"
const logger = loglevel.getLogger('console.ts')
logger.setLevel('info')

export function errorconsole(xmlError: XmlError) {
    if (xmlError.tag !== undefined) {
        let msg = "\n=============== XmlError at (" + xmlError.tag.filename
        if (xmlError.tag.line !== undefined) {
            msg += ":" + (xmlError.tag.line + 1)
        }
        if (xmlError.tag.column !== undefined) {
            msg += ":" + (xmlError.tag.column + 1)
        }
        msg += ") ===============\n"
        msg += xmlError.message
        console.log(msg)
    }
}

export class InputInstructionType extends InstructionType {
    constructor() {
        super("input")
    }
    async parseInstruction(tag: Tag, scope: Scope): Promise<Instruction> {
        let result = new InputInstruction(tag)

        return result
    }
}

class InputInstruction extends Instruction {
    constructor(tag: Tag) {
        super(tag)
    }

    async execute() {
        throw new Error("Method not implemented.")
    }
    dump(): void {
        throw new Error("Method not implemented.")
    }

}

export class PrintInstructionType extends InstructionType {
    logfilename: string
    constructor(logfilename: string) {
        super("print")
        this.logfilename = logfilename
    }
    async parseInstruction(tag: Tag, scope: Scope): Promise<Instruction> {
        let result = new PrintInstruction(tag, this.logfilename)
        return result
    }
}

class PrintInstruction extends Instruction {
    exprValue: string | undefined
    logfilename: string
    constructor(tag: Tag, logfilename: string) {
        super(tag)
        this.logfilename = logfilename
        this.parse(tag)
    }
    parse(tag: Tag): void {
        this.exprValue = tag.getText()
    }
    async execute(scope: Scope) {
        if (this.exprValue !== undefined) {
            let express = new Expression(scope)
            let value: Data | undefined | null
            try {
                value = await express.evaluate(this.exprValue)
            }
            catch (err) {
                console.log(err)
                throw (new XmlError("Expression : " + this.exprValue, this.tag))
            }
            // logger.debug("print expr " + this.exprValue + " -> " + value?.toString())
            if (value !== undefined && value !== null) {
                // console.log("testprint : " + value.toString())
                fs.appendFileSync(this.logfilename, value.toString() + "\n")
            }
            else {
                console.log(value)
                //throw (new XmlError("<print> undefined : " + this.exprValue, this.tag))
            }
        }
    }
    dump() {

    }
}
