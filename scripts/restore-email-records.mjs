import { readFile } from 'node:fs/promises'
import { restoreEmailContributions } from '../server/email-recovery.ts'
import { updateRecords } from '../server/store.ts'

if (!process.argv[2]) throw new Error('Provide the private recovered-records.json file.')
const recovered = JSON.parse(await readFile(process.argv[2], 'utf8'))
if (!Array.isArray(recovered.records)) throw new Error('Invalid recovery file')
console.log(await updateRecords(records => restoreEmailContributions(records, recovered.records)))
