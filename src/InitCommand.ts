import { Command } from "commander";
import * as fs from 'fs'
import inquirer from "inquirer";
import { getLogger } from "loglevel";

const logger = getLogger('InitCommand.ts')

logger.setLevel('debug')

export class InitCommand extends Command {

    PGPORT="5432"
    USER_NAME="cyk"
    USER_PASSWORD="cyk"
    USER_EMAIL="my-email@my-domain"
    CYK_PORT="3000"

    constructor(name: string) {
        super(name)
        this.description('initialize a folder with files necessary for a cyklang project')
            .action(async (options: any) => {
                await this.commandInit(options)
            })
    }
    async commandInit(options: any) {
        try {
            await this.promptParameters()
            await this.writeEnvFile()
            await this.writeDockerComposeFile()
        }
        catch (err) {
            logger.error(err)
        }
    }

    async promptParameters() {
        
        const reply = await inquirer.prompt([
            
            {type: "number", name: 'PGPORT', default: this.PGPORT, message: 'Postgresql Port' },
            {type: 'number', name: 'CYK_PORT', default: this.CYK_PORT, message: 'NodeJS Port'},
            {type: 'input', name: 'USER_NAME', default: this.USER_NAME, message: 'Admin User Login'},
            {type: 'input', name: 'USER_PASSWORD', default: this.USER_PASSWORD, message: 'Admin User Password'},
            {type: 'input', name: 'USER_EMAIL', default: this.USER_EMAIL, message: 'Admin Use Email'},
            {type: "confirm", name: 'confirm'}
        ])
        // logger.debug(reply)
        if (reply.confirm === false) throw 'Command cancelled'
        this.PGPORT = reply.PGPORT
        this.CYK_PORT = reply.CYK_PORT
        this.USER_NAME = reply.USER_NAME
        this.USER_PASSWORD = reply.USER_PASSWORD
        this.USER_EMAIL = reply.USER_EMAIL
    }

    // developer.mozilla.org Math.random()
    // On renvoie un entier aléatoire entre une valeur min (incluse)
    // et une valeur max (exclue).
    // Attention : si on utilisait Math.round(), on aurait une distribution
    // non uniforme !
    
    getRandomInt(min: number, max: number) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    }

    generateToken(): string {
        let result = ''
        for (let ind = 0; ind < 32; ind++ ) {
            result += this.getRandomInt(0,15).toString(16)
        }
        return result
    }

    async writeEnvFile() {
        const envFilename = '.env'
        if (fs.existsSync(envFilename) === true) {
            logger.info(envFilename + ' file already exists. Remove it before launching init command')
            return
        }

        Math.random()
        const content = `# PostgreSql connection
# used by psql command line utility
PGHOST="localhost"
PGPORT="${this.PGPORT}"
PGUSER="postgres"
PGPASSWORD="postgres"

# at postgresql database initialization

# POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"

# admin user
# created at database initialization
ADMIN_NAME=${this.USER_NAME}
ADMIN_PASSWORD=${this.USER_PASSWORD}
ADMIN_EMAIL=${this.USER_EMAIL}

# JWT token generation
# e.g. https://www.allkeysgenerator.com
# 128 bits Hex 

SECRET_TOKEN="${this.generateToken()}"
SECRET_RTOKEN="${this.generateToken()}"

# Login Page Config
LOGIN_IMAGE="https://media.smartbox.com/pim/1000001967971201770883.jpg?thumbor=800x0/filters:quality(90)"
LOGIN_TITLE="CYK Framework"
LOGIN_SUBTITLE="Une application pilote du framework CYK"
LOGIN_APPLI="index"

# credential used by cyk CLI

USER_NAME=${this.USER_NAME}
USER_PASSWORD=${this.USER_PASSWORD}
CYK_PORT="${this.CYK_PORT}"
DBREMOTE_URL="http://localhost:${this.CYK_PORT}"        
`
        fs.writeFileSync(envFilename, content)
        logger.debug('created ' + envFilename)
    }

    async writeDockerComposeFile() {
        const dockerComposeFilename = 'docker-compose.yml'
        if (fs.existsSync(dockerComposeFilename) === true) {
            logger.info(dockerComposeFilename + ' already exists. Remove it before launching init command')
            return
        }

        const modelFilename = __dirname + '/../' + dockerComposeFilename
        const content = fs.readFileSync(modelFilename)
        fs.writeFileSync(dockerComposeFilename, content)
        logger.debug('created ' + dockerComposeFilename)
    }
}