#!/usr/bin/env ts-node
import loglevel from 'loglevel'
import { Command } from 'commander'
import { DBUser } from '@cyklang/core'
import { Cmd } from './Cmd'
import { DBClient } from './DBClient'
const logger = loglevel.getLogger('UserCommand.ts')
logger.setLevel('debug')

export class UserCommand extends Command {
    constructor(name: string) {
        super(name)
        this.description('manage users in cyk_user table').version('0.1')
        this.addCommand(new UserAddCmd('add', 'add a new user'))
        this.addCommand(new UserAddCmd('a', 'add a new user'))
        this.addCommand(new UserUpdateCmd('update', 'update user by id all fields except password'))
        this.addCommand(new UserUpdateCmd('u', 'shortcut for (u)pdate'))
        this.addCommand(new UserDeleteCmd('delete', 'delete user by id and name. Both options are mandatory to avoid typing error'))
        this.addCommand(new UserPasswdCmd('passwd', 'change user password'))
        this.addCommand(new UserPasswdCmd('p', 'shortcut for (p)asswd'))
        this.addCommand(new UserListCmd('list', 'list users'))
        this.addCommand(new UserListCmd('l', 'shortcut for (l)ist'))
    }
}

interface Options {
    id: string | undefined
    name: string | undefined
    email: string | undefined
    access: string | undefined
    module: string | undefined
    password: string | undefined
    disable: boolean | undefined
    env: string | undefined
    sort: string | undefined
    lang: string | undefined
}

class UserAddCmd extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .requiredOption('-n --name <name>', 'user name')
            .option('-e --email <email>', 'user email address')
            .option('-p --password <password>', 'initial password')
            .option('-a --access <acl>', 'access control list')
            .option('-m --module <module_name>', 'module to launch by default')
            .option('-d --disable', 'user not abled to connect')
            .option('-l --lang <language>', 'user language')
            .action(async (options: Options) => {
                const dbUser = new DBUser()
                dbUser.name = options.name
                dbUser.email = options.email
                dbUser.password = options.password
                dbUser.access = options.access
                dbUser.appli = options.module
                dbUser.disable = options.disable || false
                dbUser.lang = options.lang
                await this.commandAdd(dbUser, options)
            })
    }
    async commandAdd(dbUser: DBUser, options: Options) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'
            const result = await this.dbManager.dbUserInsert(dbUser)
            logger.debug('ID', result)
            if (dbUser.password) {
                await this.dbManager.dbUserPasswd(result, dbUser.password)
                logger.info('password changed for user ' + dbUser.name)
            }
        }
        catch (err) {
            logger.error(err)
        }
    }
}

class UserListCmd extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .option('-s --sort <columns>', 'sort list by column numbers (begins by 0) separated by comma')
            .action(async (options: Options) => {
                await this.commandList(options)
            })
    }
    async commandList(options: Options) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'

            const dbClient = new DBClient(this.dbManager)
            dbClient.selectFromTable('List of users', 'cyk_user',
                { fields: 'user_id,user_name,user_email,user_access,user_appli,user_lang,user_disable', sort: options.sort || '1' })

        }
        catch (err) {
            logger.error(err)
        }
    }

}

class UserUpdateCmd extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .requiredOption('-i --id <id>', 'user ID')
            .option('-n --name <name>', 'user name')
            .option('-e --email <email>', 'user email address')
            .option('-a --access <acl>', 'access control list')
            .option('-m --module <module_name>', 'module to launch by default')
            .option('-l --lang <language>', 'user language')
            .option('-d --disable', 'user not able to connect')
            .action(async (options: Options) => {
                const dbUser = new DBUser()
                dbUser.id = options.id
                dbUser.name = options.name
                dbUser.email = options.email
                dbUser.access = options.access
                dbUser.appli = options.module
                dbUser.lang = options.lang
                dbUser.disable = options.disable
                await this.commandUpdate(dbUser, options)
            })
    }
    async commandUpdate(dbUser2: DBUser, options: Options) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'
            if (dbUser2.id === undefined) throw 'id is missing'
            const dbUser1 = await this.dbManager.getUser(dbUser2.id)
            if (dbUser1 === undefined) throw 'user with id ' + dbUser2.id + ' not found'
            // const dbUser1: DBUser = { id: user.user_id, name: user.user_name, email: user.user_email, password: user.user_password, access: user.user_access, appli: user.user_appli, disable: user.user_disable }
            if (dbUser2.name !== undefined) dbUser1.name = dbUser2.name
            if (dbUser2.email !== undefined) dbUser1.email = dbUser2.email
            if (dbUser2.access !== undefined) dbUser1.access = dbUser2.access
            if (dbUser2.appli !== undefined) dbUser1.appli = dbUser2.appli
            if (dbUser2.lang !== undefined) dbUser1.lang = dbUser2.lang
            if (dbUser2.disable !== undefined) dbUser1.disable = dbUser2.disable
            // logger.debug('dbUser1 before dbUserUpdate : ', dbUser1)
            await this.dbManager.dbUserUpdate(dbUser1)
        }
        catch (err) {
            logger.error(err)
        }
    }
}

class UserDeleteCmd extends Cmd {
    constructor(name: string, description: string) {
        super(name)
        this.description(description)
            .requiredOption('-i --id <id>', 'user ID')
            .requiredOption('-n --name <name>', 'user name')
            .action(async (options: Options) => {
                const dbUser = new DBUser()
                dbUser.id = options.id
                dbUser.name = options.name
                await this.commandDelete(dbUser, options)
            })
    }
    async commandDelete(dbUser: DBUser, options: Options) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'
            if (dbUser.id === undefined || dbUser.name === undefined) throw 'id or name missing'
            const userExist = await this.dbManager.getUser(dbUser.id)
            if (userExist === undefined) throw 'user with id ' + dbUser.id + ' not found'
            if (dbUser.name !== userExist.name) throw 'name ' + dbUser.name + ' different from ' + userExist.name
            await this.dbManager.dbUserDelete(dbUser)
        }
        catch (err) {
            logger.error(err)
        }
    }
}

class UserPasswdCmd extends Cmd {
    constructor(name: string, description: string) {
        super(name)

        this.description(description)
            .requiredOption('-i --id <id>', 'user ID')
            .requiredOption('-n --name <name>', 'user name')
            .requiredOption('-p --password <password>', 'new password')
            .action(async (options: Options) => {
                const dbUser = new DBUser()
                dbUser.id = options.id
                dbUser.name = options.name
                dbUser.password = options.password
                await this.commandPasswd(dbUser, options)
            })
    }
    async commandPasswd(dbUser: DBUser, options: Options) {
        try {
            await this.prologue(options)
            if (this.dbManager === undefined) throw 'dbManager undefined'
            // logger.debug(dbUser)
            if (dbUser.id === undefined || dbUser.name === undefined || dbUser.password === undefined) throw 'id or name or password missing'
            const userExist = await this.dbManager.getUser(dbUser.id)
            if (userExist === undefined) throw 'user with id ' + dbUser.id + ' not found'
            if (dbUser.name !== userExist.name) throw 'name ' + dbUser.name + ' different from ' + userExist.name
            await this.dbManager.dbUserPasswd(dbUser.id, dbUser.password)
            logger.info('password changed for user ' + dbUser.name)
        }
        catch (err) {
            logger.error(err)
        }
    }
}



