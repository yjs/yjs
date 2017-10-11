import Delete from '../Struct/Delete'
import ID from './ID'

export default function deleteItemRange (y, user, clock, length) {
  let del = new Delete()
  del._target = new ID(user, clock)
  del._length = length
  del._integrate(y)
}
