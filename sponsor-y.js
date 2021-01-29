
const log = require('lib0/dist/logging.cjs')

log.print()
log.print(log.BOLD, log.GREEN, log.BOLD, 'Thank you for using Yjs ', log.RED, '❤\n')
log.print(
  log.GREY,
  'The project has grown considerably in the past year. Too much for me to maintain\nin my spare time. Several companies built their products with Yjs.\nYet, this project receives very little funding. Yjs is far from done. I want to\ncreate more awesome extensions and work on the growing number of open issues.\n', log.BOLD, 'Dear user, the future of this project entirely depends on you.\n')
log.print(log.BLUE, log.BOLD, 'Please start funding the project now: https://github.com/sponsors/dmonad \n')
log.print(log.GREY, '(This message will be removed when I achieved my funding goal)\n\n')
