#!/usr/bin/env node
import loglevel from 'loglevel'
import { Command } from 'commander'
import { ModuleCommand } from "./ModuleCommand"
import { UserCommand } from './UserCommand'
import { QueryCommand } from './QueryCommand'
import { TableCommand } from './TableCommand'
import { TestCommand } from './TestCommand'
import { RunCommand } from './RunCommand'
import { InstallCommand } from './InstallCommand'
import { AssetCommand } from './AssetCommand'
import { OpenCommand } from './OpenCommand'
import { UninstallCommand } from './UninstallCommand'
const logger = loglevel.getLogger("index.ts")
logger.setLevel("debug")

const program = new Command()
program.name('cyk').description('cyklang CLI')
    .version('0.5.6')

program.addCommand(new InstallCommand('install'))
program.addCommand(new InstallCommand('i'))
program.addCommand(new UninstallCommand('uninstall'))
program.addCommand(new AssetCommand('asset', 'manage assets'))
program.addCommand(new AssetCommand('a', 'manage assets'))
program.addCommand(new ModuleCommand('module'))
program.addCommand(new ModuleCommand('m'))
program.addCommand(new UserCommand('user'))
program.addCommand(new UserCommand('u'))
program.addCommand(new QueryCommand('query'))
program.addCommand(new QueryCommand('q'))
program.addCommand(new TableCommand('table'))
program.addCommand(new TableCommand('t'))
program.addCommand(new TestCommand())
program.addCommand(new RunCommand('run'))
program.addCommand(new RunCommand('r'))
program.addCommand(new OpenCommand('open'))
program.addCommand(new OpenCommand('o'))

program.parse()
