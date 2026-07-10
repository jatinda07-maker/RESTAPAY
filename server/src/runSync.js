import { syncToastExports } from './syncService.js'

syncToastExports()
  .then(result => { console.log(result); process.exit(0) })
  .catch(error => { console.error(error); process.exit(1) })
