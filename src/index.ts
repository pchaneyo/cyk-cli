#!/usr/bin/env ts-node
import loglevel from 'loglevel'
import { Command } from 'commander'
import { ModuleCommand } from "./ModuleCommand"
import { UserCommand } from './UserCommand'
import { QueryCommand } from './QueryCommand'
import { TableCommand } from './TableCommand'
import { TestCommand } from './TestCommand'
import { RunCommand } from './RunCommand'
const logger = loglevel.getLogger("index.ts")
logger.setLevel("debug")

const program = new Command()
program.name('cyk').description('cyklang CLI')
    .version('0.2')

program.addCommand(new ModuleCommand('module'))
program.addCommand(new ModuleCommand('m'))
program.addCommand(new UserCommand('user'))
program.addCommand(new UserCommand('u'))
program.addCommand(new QueryCommand('query'))
program.addCommand(new QueryCommand('q'))
program.addCommand(new TableCommand('table'))
program.addCommand(new TableCommand('t'))
program.addCommand(new TestCommand())
program.addCommand(new RunCommand())

program.parse()
