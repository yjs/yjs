import { AbstractType, Doc } from '../internals.js'

/**
 * - [ ] Write sample documentation on gitbook
 * - [ ] Fill out functions
 * - [ ] Add pos functionality to insertAfter
 * - [ ] Think about walking api: pos.walk(1) pos.walk(-3)
 * - [ ] Should only recompute path if necessary.
 * - [ ] types should have property type.pos
 * - [ ] should type have api ytext.getPos(3) & ytext.getRange(3, 65) ??
 */

/**
 * @param {Doc} ydoc
 * @param {Uint8Array} buf
 * @return {Pos}
 */
export const decodePos = (ydoc, buf) => {

}

/**
 * @param {Doc} ydoc
 * @param {any} json
 * @return {Pos}
 */
export const decodePosJSON = (ydoc, json) => {

}

/**
 * The new position API. It implements the same functionality as Relative Pos, but has convenient methods to work with positions.
 *
 */
export class Pos {
  constructor () {

  }

  /**
   * @param {AbstractType<any>} type
   * @param {number|string} index
   * @return {Pos}
   */
  static from (type, index) {

  }

  /**
   * @type {boolean}
   */
  get deleted () {

  }

  /**
   * @type {Array<{parent: AbstractType<any>, index: number}|{ parent: AbstractType<any>, key: string }>}
   */
  get path () {

  }

  /**
   * Delete the pointed content.
   *
   * If this points to list content, it will delete len=1 characters starting from the pointed position.
   *
   * If this points to a map-attribute, it will delete the curent value.
   *
   * @param {number?} len
   */
  delete (len) {

  }

  /**
   * Retrieves the current value of the pointed position.
   *
   * @return {any}
   */
  get () {

  }

  /**
   * Encode the position to a uint8array that you can send to other peers.
   *
   * @return {Uint8Array}
   */
  encode () {

  }

  /**
   * Encode the position to a JSON object that you can send to other peers.
   *
   * @return {any}
   */
  encodeJSON () {

  }
}

/**
 * @todo decide if we want a range API.
 */
class Range {
  constructor (anchor, head) {
    this.start =
    this.end =
    this.forward =
  }

  delete () {}

  encode () {}


}

