import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getLogger } from 'loglevel'
import { CryptoEngine } from '@cyklang/core'
import { cipherKey } from '@cyklang/core'
import pako from 'pako'
import { TextDecoder } from 'util'
const logger = getLogger('NodeCrypto.ts')
logger.setLevel('debug')

const algorithm = 'aes-128-cbc'
const iv_length = 16

export class NodeCrypto implements CryptoEngine {

    // last_iv: Buffer | undefined

    async encrypt(plain: string): Promise<string> {

        const deflatedData = pako.deflate(plain)
        // logger.debug('deflatedData : ', deflatedData[0], deflatedData[1])
        const iv: Buffer = randomBytes(iv_length)
        // this.last_iv = iv

        // logger.debug("encrypt iv " + iv.toString('hex'))

        const cipher = createCipheriv(algorithm, cipherKey, iv)
        let result = cipher.update(deflatedData, undefined, "hex")
        result += cipher.final("hex")
        result += iv.toString('hex')

        return result
    }

    async decrypt(encoded: string): Promise<string> {

        const iv_hex = encoded.substring(encoded.length - 2 * iv_length)
        const encryptedData = encoded.substring(0, encoded.length - 2 * iv_length)

        // logger.debug("decrypt iv " + iv_hex)
        const iv = Buffer.from(iv_hex, 'hex')

        // if (this.last_iv === undefined) throw 'last_iv undefined'
        // if (Buffer.compare(iv, this.last_iv) !== 0) throw 'iv and last_iv are different'

        const decipher = createDecipheriv(algorithm, cipherKey, iv)
        let deflatedData1 = decipher.update(encryptedData, 'hex')
        
        const deflatedData2 = decipher.final()
        const deflatedData = Buffer.concat([deflatedData1, deflatedData2])

        let inflatedData = deflatedData
        if (deflatedData[0] === 0x78 && deflatedData[1] === 0x9c) {
            inflatedData = Buffer.from(pako.inflate(deflatedData))
        }

        const result = (new TextDecoder()).decode(inflatedData)
        return result
    }
}

