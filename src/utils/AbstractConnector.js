
import { Observable } from 'lib0/observable'

import {
  Doc // eslint-disable-line
} from '../internals.js'

/**
 * This is an abstract interface that all Connectors should implement to keep them interchangeable.
 *
 * @note This interface is experimental and it is not advised to actually inherit this class.
 *       It just serves as typing information.
 *
 * @extends {Observable<any>}
 */
export class AbstractConnector extends Observable {
  /**
   * @param {Doc} ydoc
   * @param {any} awareness
   */
  constructor (ydoc, awareness) {
    super()
    this.doc = ydoc
    this.awareness = awareness
  }
}
