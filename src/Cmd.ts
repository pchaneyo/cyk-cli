import { DBManager, DBRemote, SigninResponse, Structure } from "@cyklang/core";
import { Command } from "commander";
import dotenv from 'dotenv'
import loglevel from 'loglevel'
import { NodeCrypto } from "./NodeCrypto";
const logger = loglevel.getLogger('Cmd.ts')
logger.setLevel('debug')

export class Cmd extends Command {
    dbManager: DBManager | undefined
    dbRemote: DBRemote | undefined

    constructor(name: string) {
        super(name);
        this.option('--env <env>', 'path to the environment variables file')
    }

    async prologue(options: any): Promise<SigninResponse> {

        const dotenvOutput = dotenv.config({ path: options.env })
        if (dotenvOutput.error !== undefined) throw dotenvOutput.error

        const structure = new Structure()
        if (process.env.DBREMOTE_URL === undefined) throw 'DBREMOTE_URL undefined'
        logger.debug('Cmd.DBREMOTE_URL ' + process.env.DBREMOTE_URL)
        const nodeCrypto = new NodeCrypto()
        this.dbRemote = new DBRemote(structure.scope, process.env.DBREMOTE_URL, nodeCrypto)
        const login = await this.dbRemote.signin(process.env.USER_NAME, undefined, process.env.USER_PASSWORD)
        // logger.debug(login)

        this.dbManager = new DBManager(structure.scope, this.dbRemote)
        await this.dbManager.initialize()

        return login


    }
}